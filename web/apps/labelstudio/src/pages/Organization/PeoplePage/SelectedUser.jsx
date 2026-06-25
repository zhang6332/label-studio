import { format } from "date-fns";
import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { IconCross } from "@humansignal/icons";
import { Userpic, Button, useToast } from "@humansignal/ui";
import { useAuth } from "@humansignal/core/providers/AuthProvider";
import { cn } from "../../../utils/bem";
import { useAPI } from "../../../providers/ApiProvider";
import "./SelectedUser.scss";

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "reviewer", label: "Reviewer" },
  { value: "annotator", label: "Annotator" },
];

const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map(({ value, label }) => [value, label]));

const UserProjectsLinks = ({ projects }) => {
  return (
    <div className={cn("user-info").elem("links-list").toClassName()}>
      {projects.map((project) => (
        <NavLink
          className={cn("user-info").elem("project-link").toClassName()}
          key={`project-${project.id}`}
          to={`/projects/${project.id}`}
          data-external
        >
          {project.title}
        </NavLink>
      ))}
    </div>
  );
};

export const SelectedUser = ({ user, onClose, onRoleChanged }) => {
  const api = useAPI();
  const toast = useToast();
  const auth = useAuth();
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRole(user.role);
  }, [user.id, user.role]);

  const isOwner = role === "owner" || user.role === "owner";
  const canEditRole = !isOwner && auth.can("organizations.change");

  const commitRole = async (nextRole) => {
    if (!nextRole || nextRole === user.role || saving) return;
    setSaving(true);
    try {
      const updated = await api.callApi("updateMembership", {
        params: { pk: auth.user?.active_organization, userPk: user.id },
        body: { role: nextRole },
      });
      setRole(updated?.role ?? nextRole);
      onRoleChanged?.(user.id, updated?.role ?? nextRole);
      toast.show({ message: `Role updated to ${ROLE_LABEL[updated?.role ?? nextRole] ?? updated?.role}` });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) {
        toast.show({ message: "You don't have permission to change this role.", type: "error" });
      } else {
        toast.show({ message: "Failed to update role.", type: "error" });
      }
      setRole(user.role);
    } finally {
      setSaving(false);
    }
  };

  const fullName = [user.first_name, user.last_name]
    .filter((n) => !!n)
    .join(" ")
    .trim();

  return (
    <div className={cn("user-info").toClassName()}>
      <Button
        look="string"
        onClick={onClose}
        className="absolute top-[20px] right-[24px]"
        aria-label="Close user details"
      >
        <IconCross />
      </Button>

      <div className={cn("user-info").elem("header").toClassName()}>
        <Userpic user={user} style={{ width: 64, height: 64, fontSize: 28 }} />
        <div className={cn("user-info").elem("info-wrapper").toClassName()}>
          {fullName && <div className={cn("user-info").elem("full-name").toClassName()}>{fullName}</div>}
          <p className={cn("user-info").elem("email").toClassName()}>{user.email}</p>
        </div>
      </div>

      <div className={cn("user-info").elem("section").toClassName()}>
        <div className={cn("user-info").elem("section-title").toClassName()}>Role</div>
        {canEditRole ? (
          <select
            value={role}
            disabled={saving}
            onChange={(e) => commitRole(e.target.value)}
            aria-label="Member role"
            className={cn("user-info").elem("role-select").toClassName()}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <div className={cn("user-info").elem("role-readonly").toClassName()}>
            {ROLE_LABEL[role] ?? role}
          </div>
        )}
      </div>

      {user.phone && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <a href={`tel:${user.phone}`}>{user.phone}</a>
        </div>
      )}

      {!!user.created_projects.length && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <div className={cn("user-info").elem("section-title").toClassName()}>Created Projects</div>

          <UserProjectsLinks projects={user.created_projects} />
        </div>
      )}

      {!!user.contributed_to_projects.length && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <div className={cn("user-info").elem("section-title").toClassName()}>Contributed to</div>

          <UserProjectsLinks projects={user.contributed_to_projects} />
        </div>
      )}

      <p className={cn("user-info").elem("last-active").toClassName()}>
        Last activity on: {format(new Date(user.last_activity), "dd MMM yyyy, KK:mm a")}
      </p>
    </div>
  );
};
