"""Test suite for the open-source RBAC implementation.

Covers:
1. Default role assignment on membership creation.
2. Owner override (organization creator always has all permissions).
3. Permission matrix per role (owner/manager/reviewer/annotator).
4. ProjectMember role escalation only applies to that project's scope.
5. PATCH /api/organizations/:pk/memberships/:userPk/ — role update endpoint.
6. OrganizationMember.list serializer exposes the `role` field.
7. Owner role is not assignable via the PATCH endpoint.
"""
from __future__ import annotations

from urllib.parse import urlencode

from core.rbac import (
    DEFAULT_ORG_ROLE,
    DEFAULT_PROJECT_ROLE,
    Roles,
    ROLE_PERMISSIONS,
    permissions_for_role,
    user_effective_permissions,
    user_has_permission,
)
from core.permissions import all_permissions
from organizations.models import OrganizationMember
from organizations.tests.factories import OrganizationFactory
from projects.models import ProjectMember
from projects.tests.factories import ProjectFactory
from rest_framework.test import APITestCase
from users.tests.factories import UserFactory


def _set_role(user, org, role):
    """Force-set a role on an existing membership via save() so that
    OrganizationMember.save() normalization rules apply consistently."""
    member = OrganizationMember.objects.get(user=user, organization=org)
    member.role = role
    member.save()
    member.refresh_from_db()
    return member


class TestRBACRoleAssignment(APITestCase):
    def test_default_org_role_is_annotator(self):
        org = OrganizationFactory()
        creator_member = org.members.first()
        self.assertEqual(creator_member.effective_role, Roles.OWNER)
        other = UserFactory(active_organization=org)
        member = OrganizationMember.objects.get(user=other, organization=org)
        self.assertEqual(member.role, DEFAULT_ORG_ROLE)

    def test_owner_role_is_demoted_for_non_creators(self):
        org = OrganizationFactory()
        other = UserFactory(active_organization=org)
        # Attempting to assign 'owner' to a non-creator is normalized
        # back to manager on save() — owner is reserved for the creator.
        member = _set_role(other, org, Roles.OWNER)
        self.assertEqual(member.role, Roles.MANAGER)
        self.assertEqual(member.effective_role, Roles.MANAGER)

    def test_invalid_role_falls_back_to_default(self):
        org = OrganizationFactory()
        other = UserFactory(active_organization=org)
        member = _set_role(other, org, 'not-a-real-role')
        self.assertEqual(member.role, DEFAULT_ORG_ROLE)


class TestRBACPermissionMatrix(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.organization = OrganizationFactory()
        cls.owner = cls.organization.created_by
        cls.manager = UserFactory(active_organization=cls.organization)
        cls.reviewer = UserFactory(active_organization=cls.organization)
        cls.annotator = UserFactory(active_organization=cls.organization)
        _set_role(cls.manager, cls.organization, Roles.MANAGER)
        _set_role(cls.reviewer, cls.organization, Roles.REVIEWER)
        _set_role(cls.annotator, cls.organization, Roles.ANNOTATOR)

    def _perms(self, user):
        user.active_organization = self.organization
        user.save(update_fields=['active_organization'])
        return user_effective_permissions(user)

    def test_owner_has_all_permissions(self):
        granted = self._perms(self.owner)
        for _, perm in all_permissions:
            self.assertIn(perm, granted, f'owner should have {perm}')

    def test_manager_has_no_org_delete_or_create(self):
        granted = self._perms(self.manager)
        self.assertNotIn(all_permissions.organizations_delete, granted)
        self.assertNotIn(all_permissions.organizations_create, granted)
        self.assertIn(all_permissions.projects_change, granted)
        self.assertIn(all_permissions.annotations_delete, granted)

    def test_reviewer_cannot_change_project_or_create_tasks(self):
        granted = self._perms(self.reviewer)
        self.assertNotIn(all_permissions.projects_change, granted)
        self.assertNotIn(all_permissions.projects_create, granted)
        self.assertNotIn(all_permissions.tasks_create, granted)
        self.assertIn(all_permissions.annotations_view, granted)
        self.assertIn(all_permissions.annotations_change, granted)
        self.assertIn(all_permissions.annotations_delete, granted)

    def test_annotator_cannot_delete_annotations(self):
        granted = self._perms(self.annotator)
        self.assertNotIn(all_permissions.annotations_delete, granted)
        self.assertNotIn(all_permissions.projects_change, granted)
        self.assertIn(all_permissions.annotations_create, granted)
        self.assertIn(all_permissions.annotations_view, granted)

    def test_role_to_permissions_consistency(self):
        full = {perm for _, perm in all_permissions}
        for role, perms in ROLE_PERMISSIONS.items():
            self.assertTrue(
                perms.issubset(full),
                f'role {role} references unknown permissions: {perms - full}',
            )


class TestProjectMemberRoleEscalation(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.organization = OrganizationFactory()
        cls.owner = cls.organization.created_by
        cls.project = ProjectFactory(created_by=cls.owner, organization=cls.organization)
        cls.user = UserFactory(active_organization=cls.organization)
        _set_role(cls.user, cls.organization, Roles.ANNOTATOR)

    def test_project_member_role_grants_additional_permissions(self):
        self.user.active_organization = self.organization
        self.user.save()
        baseline = user_effective_permissions(self.user)
        self.assertNotIn(all_permissions.annotations_delete, baseline)

        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role=Roles.REVIEWER,
        )
        escalated = user_effective_permissions(self.user)
        self.assertIn(all_permissions.annotations_delete, escalated)

    def test_project_member_default_role_is_annotator(self):
        pm = ProjectMember.objects.create(user=self.user, project=self.project)
        self.assertEqual(pm.role, DEFAULT_PROJECT_ROLE)
        self.assertEqual(set(pm.permissions), set(permissions_for_role(Roles.ANNOTATOR)))


class TestMembershipRoleUpdateAPI(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.organization = OrganizationFactory()
        cls.owner = cls.organization.created_by
        cls.target = UserFactory(active_organization=cls.organization)
        _set_role(cls.target, cls.organization, Roles.ANNOTATOR)

    def _url(self, user_pk):
        return f'/api/organizations/{self.organization.id}/memberships/{user_pk}/'

    def test_owner_can_change_member_role(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(self._url(self.target.id), data={'role': Roles.REVIEWER})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['role'], Roles.REVIEWER)
        member = OrganizationMember.objects.get(user=self.target, organization=self.organization)
        self.assertEqual(member.role, Roles.REVIEWER)

    def test_annotator_cannot_change_member_role(self):
        annotator = UserFactory(active_organization=self.organization)
        _set_role(annotator, self.organization, Roles.ANNOTATOR)
        self.client.force_authenticate(user=annotator)
        response = self.client.patch(self._url(self.target.id), data={'role': Roles.MANAGER})
        self.assertEqual(response.status_code, 403, response.content)

    def test_owner_role_cannot_be_assigned(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(self._url(self.target.id), data={'role': Roles.OWNER})
        self.assertIn(response.status_code, (400, 403), response.content)

    def test_cannot_change_owner_role(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(self._url(self.owner.id), data={'role': Roles.MANAGER})
        self.assertEqual(response.status_code, 403, response.content)


class TestMembershipListIncludesRole(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.organization = OrganizationFactory()
        cls.owner = cls.organization.created_by
        cls.user = UserFactory(active_organization=cls.organization)
        _set_role(cls.user, cls.organization, Roles.REVIEWER)

    def test_list_payload_contains_role_field(self):
        self.client.force_authenticate(user=self.owner)
        url = f'/api/organizations/{self.organization.id}/memberships?{urlencode({})}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.content)
        roles_returned = {entry['role'] for entry in response.json()['results']}
        self.assertIn(Roles.OWNER, roles_returned)
        self.assertIn(Roles.REVIEWER, roles_returned)


class TestUserHasPermissionHelpers(APITestCase):
    def test_anonymous_user_has_no_permissions(self):
        class _FakeUser:
            is_authenticated = False

        self.assertEqual(user_effective_permissions(_FakeUser()), set())
        self.assertFalse(user_has_permission(_FakeUser(), 'anything.view'))

    def test_none_user_safe(self):
        self.assertEqual(user_effective_permissions(None), set())
        self.assertFalse(user_has_permission(None, 'projects.view'))
        # Empty permission string is treated as "no requirement" → True
        self.assertTrue(user_has_permission(None, ''))
