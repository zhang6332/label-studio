"""DRF permission classes that bridge RBAC roles into the existing
`permission_required` class attribute used across Label Studio views.

The community build used to short-circuit every check to `is_authenticated`,
which made any user invited via the organization invite link effectively
all-powerful. We now resolve the view's required permission through
`core.rbac.user_has_permission`, while preserving object-level checks
(`HasObjectPermission`) for organization / project scoping.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS

from core.rbac import user_has_permission


def _user_meets_view_required_permission(request, view) -> bool:
    """Resolve `view.permission_required` (str | ViewClassPermission | None)
    against the user's effective RBAC permission set.

    `ViewClassPermission` from `core.permissions` exposes GET/POST/PATCH/PUT/
    DELETE attributes — we read the one matching the current request method.
    """
    required = getattr(view, 'permission_required', None)
    if required is None:
        return True
    if isinstance(required, str):
        return user_has_permission(request.user, required)
    if isinstance(required, dict):
        perm = required.get(request.method)
        if perm is None:
            return True
        if isinstance(perm, (list, tuple, set)):
            return any(user_has_permission(request.user, p) for p in perm)
        return user_has_permission(request.user, perm)
    # ViewClassPermission-like object exposing method-named attributes.
    method_perm = getattr(required, request.method, None)
    if method_perm is None:
        return True
    if isinstance(method_perm, (list, tuple, set)):
        return any(user_has_permission(request.user, p) for p in method_perm)
    return user_has_permission(request.user, method_perm)


class HasObjectPermission(BasePermission):
    """Object-level: user must be in org/project AND have the role-required perm."""
    def has_object_permission(self, request, view, obj):
        can_access = obj.has_permission(request.user) if hasattr(obj, 'has_permission') else True
        return can_access and _user_meets_view_required_permission(request, view)


class MemberHasOwnerPermission(BasePermission):
    """Unsafe methods require organization ownership; safe methods use RBAC."""
    def has_object_permission(self, request, view, obj):
        if request.method not in SAFE_METHODS and not request.user.own_organization:
            return False
        can_access = obj.has_permission(request.user) if hasattr(obj, 'has_permission') else True
        return can_access and _user_meets_view_required_permission(request, view)


class RBACPermission(BasePermission):
    """View-level (non-object) RBAC check.

    Attach to any view that already exposes `permission_required` to enforce
    role-based access *before* the object is fetched.
    """
    def has_permission(self, request, view):
        return _user_meets_view_required_permission(request, view)
