"""Role-Based Access Control for the open-source Label Studio build.

Provides four roles layered on top of the existing flat permission list
defined in `core.permissions`. The roles are intentionally simple to keep
the open-source fork compatible with the existing API surface while
restoring the principle of least privilege for users invited via the
organization invite link.

Roles (most -> least privileged):
    owner      Derived from `Organization.created_by`. Cannot be assigned.
    manager    Full administrative power inside the organization except
               deleting the organization itself.
    reviewer   Read-everything + delete/modify annotations.
    annotator  Self-only annotation create/modify; read on project scope.

`ProjectMember.role` is scoped to a single project and is independent of
the organization-level role; the effective permission set is the union of
permissions granted by either role, which keeps existing collaborative
flows working without forcing a per-project role assignment for every user.
"""
from __future__ import annotations

from typing import Iterable

from core.permissions import all_permissions


# ---------------------------------------------------------------------------
# Role constants
# ---------------------------------------------------------------------------

class Roles:
    OWNER = 'owner'
    MANAGER = 'manager'
    REVIEWER = 'reviewer'
    ANNOTATOR = 'annotator'

    CHOICES = (
        (OWNER, 'Owner'),
        (MANAGER, 'Manager'),
        (REVIEWER, 'Reviewer'),
        (ANNOTATOR, 'Annotator'),
    )

    ORG_LEVEL = (OWNER, MANAGER, REVIEWER, ANNOTATOR)
    PROJECT_LEVEL = (MANAGER, REVIEWER, ANNOTATOR)


# ---------------------------------------------------------------------------
# Permission matrix
#
# Each set lists the `core.permissions.all_permissions` string values that
# the role grants. `OWNER` is computed dynamically (all permissions) so
# newly-added permissions are automatically covered.
# ---------------------------------------------------------------------------

_ALL = {perm for _, perm in all_permissions}

_MANAGER_PERMS = _ALL - {
    all_permissions.organizations_create,
    all_permissions.organizations_delete,
}

_REVIEWER_PERMS = {
    all_permissions.organizations_view,
    all_permissions.projects_view,
    all_permissions.projects_reset_cache,
    all_permissions.tasks_view,
    all_permissions.views_view,
    all_permissions.views_create,
    all_permissions.views_change,
    all_permissions.views_delete,
    all_permissions.views_reset,
    all_permissions.annotations_view,
    all_permissions.annotations_change,
    all_permissions.annotations_delete,
    all_permissions.actions_perform,
    all_permissions.predictions_any,
    all_permissions.labels_view,
    all_permissions.models_view,
    all_permissions.model_provider_connection_view,
    all_permissions.webhooks_view,
    all_permissions.storages_view,
}

_ANNOTATOR_PERMS = {
    all_permissions.organizations_view,
    all_permissions.projects_view,
    all_permissions.tasks_view,
    all_permissions.views_view,
    all_permissions.annotations_create,
    all_permissions.annotations_view,
    all_permissions.annotations_change,
    all_permissions.actions_perform,
    all_permissions.predictions_any,
    all_permissions.labels_view,
}

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    Roles.OWNER: frozenset(_ALL),
    Roles.MANAGER: frozenset(_MANAGER_PERMS),
    Roles.REVIEWER: frozenset(_REVIEWER_PERMS),
    Roles.ANNOTATOR: frozenset(_ANNOTATOR_PERMS),
}

DEFAULT_ORG_ROLE = Roles.ANNOTATOR
DEFAULT_PROJECT_ROLE = Roles.ANNOTATOR


def is_valid_org_role(role: str | None) -> bool:
    return role in Roles.ORG_LEVEL


def is_valid_project_role(role: str | None) -> bool:
    return role in Roles.PROJECT_LEVEL


def normalize_org_role(role: str | None) -> str:
    if role in Roles.ORG_LEVEL:
        return role
    return DEFAULT_ORG_ROLE


def normalize_project_role(role: str | None) -> str:
    if role in Roles.PROJECT_LEVEL:
        return role
    return DEFAULT_PROJECT_ROLE


def permissions_for_role(role: str | None) -> frozenset[str]:
    return ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS[Roles.ANNOTATOR])


def user_effective_permissions(user) -> set[str]:
    """Union of permissions granted by the user's org role and any
    project-member roles. Anonymous / unauthenticated users get the empty set.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return set()

    org = getattr(user, 'active_organization', None)

    # Owner override: organization creators always get the full set.
    if org is not None and org.created_by_id == user.id:
        return set(ROLE_PERMISSIONS[Roles.OWNER])

    granted: set[str] = set()

    # Organization-level role
    from organizations.models import OrganizationMember
    qs = OrganizationMember.objects.filter(user=user, deleted_at__isnull=True)
    for member in qs.select_related('organization'):
        if member.organization_id == getattr(org, 'id', None):
            granted |= set(member.permissions)

    # Project-member role (project-scoped escalation)
    from projects.models import ProjectMember
    pm_qs = ProjectMember.objects.filter(user=user, enabled=True)
    for pm in pm_qs.select_related('project'):
        if org is None or pm.project.organization_id == org.id:
            granted |= set(pm.permissions)

    return granted


def user_has_permission(user, permission: str) -> bool:
    """True if the user's effective permissions include the given perm string."""
    if not permission:
        return True
    return permission in user_effective_permissions(user)


def user_has_any_permission(user, permissions: Iterable[str]) -> bool:
    if not permissions:
        return True
    granted = user_effective_permissions(user)
    return any(p in granted for p in permissions)


__all__ = [
    'Roles',
    'ROLE_PERMISSIONS',
    'DEFAULT_ORG_ROLE',
    'DEFAULT_PROJECT_ROLE',
    'is_valid_org_role',
    'is_valid_project_role',
    'normalize_org_role',
    'normalize_project_role',
    'permissions_for_role',
    'user_effective_permissions',
    'user_has_permission',
    'user_has_any_permission',
]
