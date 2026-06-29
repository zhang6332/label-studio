import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { NavLink } from "react-router-dom";
import { IconCross } from "@humansignal/icons";
import { Userpic, Button } from "@humansignal/ui";
import { useAuth } from "@humansignal/core/providers/AuthProvider";
import { cn } from "../../../utils/bem";
import { getLang, t } from "../../../i18n";
import "./SelectedUser.scss";

const ROLE_BADGE = {
  owner: t("Owner"),
  manager: t("Manager"),
  reviewer: t("Reviewer"),
  annotator: t("Annotator"),
};

// Role hierarchy: Owner 4 > Manager 3 > Reviewer 2 > Annotator 1.
const ROLE_LEVEL = { owner: 4, manager: 3, reviewer: 2, annotator: 1 };

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

// Read-only user detail panel. Every user — including the Owner — is shown the
// same way; role changes happen through the Edit modal (onEdit) instead of an
// inline <select>, so a role change is never accidental.
export const SelectedUser = ({ user, onClose, onEdit }) => {
  const auth = useAuth();
  const isOwner = user.role === "owner";
  const requesterIsOwner = Boolean(auth.user) && auth.user.active_organization_meta?.email === auth.user.email;
  const requesterLevel = requesterIsOwner ? 4 : auth.permissions.can("organizations.change") ? 3 : 1;
  const targetLevel = ROLE_LEVEL[user.role] ?? 1;
  // Edit button only when the requester outranks the target and it is not
  // themselves — mirrors the backend can_manage_user rule.
  const canEdit = !isOwner && user.id !== auth.user?.id && requesterLevel > targetLevel;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  return (
    <div className={cn("user-info").toClassName()}>
      <Button
        look="string"
        onClick={onClose}
        className="absolute top-[20px] right-[24px]"
        aria-label={t("Close user details")}
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
        <div className={cn("user-info").elem("section-title").toClassName()}>{t("Role")}</div>
        <div className={cn("user-info").elem("role-badge").toClassName()}>{ROLE_BADGE[user.role] ?? user.role}</div>
      </div>

      {user.phone && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <a href={`tel:${user.phone}`}>{user.phone}</a>
        </div>
      )}

      {!!user.created_projects?.length && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <div className={cn("user-info").elem("section-title").toClassName()}>{t("Created Projects")}</div>
          <UserProjectsLinks projects={user.created_projects} />
        </div>
      )}

      {!!user.contributed_to_projects?.length && (
        <div className={cn("user-info").elem("section").toClassName()}>
          <div className={cn("user-info").elem("section-title").toClassName()}>{t("Contributed to")}</div>
          <UserProjectsLinks projects={user.contributed_to_projects} />
        </div>
      )}

      <p className={cn("user-info").elem("last-active").toClassName()} data-i18n-skip>
        {getLang() === "zh-CN" ? "最近活动于：" : "Last activity on: "}
        {user.last_activity
          ? format(
              new Date(user.last_activity),
              // zh-CN pattern → "2026 6月 26 07:39 下午" (年月日 上下午)
              // en pattern    → "26 Jun 2026 07:39 PM"  (日月年, no comma)
              getLang() === "zh-CN" ? "yyyy MMM d KK:mm a" : "dd MMM yyyy KK:mm a",
              { locale: getLang() === "zh-CN" ? zhCN : undefined },
            )
          : "—"}
      </p>

      {canEdit && (
        <div className={cn("user-info").elem("actions").toClassName()}>
          <Button look="primary" onClick={() => onEdit?.(user)}>
            {t("Edit")}
          </Button>
        </div>
      )}
    </div>
  );
};
