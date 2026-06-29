import { formatDistance } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useCallback, useEffect, useState } from "react";
import { Spinner } from "../../../components";
import { Userpic } from "@humansignal/ui";
import { CopyableTooltip } from "../../../components/CopyableTooltip/CopyableTooltip";
import { useAPI } from "../../../providers/ApiProvider";
import { cn } from "../../../utils/bem";
import { getLang, t } from "../../../i18n";
import "./PeopleList.scss";

const ROLE_LABELS = {
  owner: t("Owner"),
  manager: t("Manager"),
  reviewer: t("Reviewer"),
  annotator: t("Annotator"),
};

export const AllUsersList = ({ onSelect, selectedUser }) => {
  const api = useAPI();
  const [users, setUsers] = useState(null);

  const fetchUsers = useCallback(async () => {
    const response = await api.callApi("allUsers", {});
    if (response) setUsers(response);
  }, [api]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (!users) {
    return (
      <div className={cn("people-list").elem("loading").toClassName()}>
        <Spinner size={36} />
      </div>
    );
  }

  return (
    <div className={cn("people-list").toClassName()}>
      <div className={cn("people-list").elem("wrapper").toClassName()}>
        <div className={cn("people-list").elem("users").toClassName()}>
          <div className={cn("people-list").elem("header").toClassName()}>
            <div className={cn("people-list").elem("column").mix("avatar").toClassName()} />
            <div className={cn("people-list").elem("column").mix("email").toClassName()}>{t("Email")}</div>
            <div className={cn("people-list").elem("column").mix("name").toClassName()}>{t("Name")}</div>
            <div className={cn("people-list").elem("column").mix("phone").toClassName()}>{t("Phone")}</div>
            <div className={cn("people-list").elem("column").mix("role").toClassName()}>{t("Role")}</div>
            <div className={cn("people-list").elem("column").mix("last-activity").toClassName()}>
              {t("Last Activity")}
            </div>
            <div className={cn("people-list").elem("column").mix("orgs").toClassName()}>{t("Organizations")}</div>
          </div>
          <div className={cn("people-list").elem("body").toClassName()}>
            {users.map((u) => {
              const active = u.id === selectedUser?.id;
              const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
              const primaryRole = u.memberships?.[0]?.role;
              const userObj = {
                id: u.id,
                email: u.email,
                first_name: u.first_name || "",
                last_name: u.last_name || "",
                role: primaryRole,
                memberships: u.memberships,
                avatar: u.avatar,
                last_activity: u.last_activity || null,
                phone: u.phone || "",
                created_projects: u.created_projects || [],
                contributed_to_projects: u.contributed_to_projects || [],
              };
              return (
                <div
                  key={`alluser-${u.id}`}
                  className={cn("people-list").elem("user").mod({ active }).toClassName()}
                  onClick={() => onSelect?.(userObj)}
                >
                  <div className={cn("people-list").elem("field").mix("avatar").toClassName()}>
                    <CopyableTooltip title={`User ID: ${u.id}`} textForCopy={u.id}>
                      <Userpic user={userObj} style={{ width: 28, height: 28 }} />
                    </CopyableTooltip>
                  </div>
                  <div className={cn("people-list").elem("field").mix("email").toClassName()}>{u.email}</div>
                  <div className={cn("people-list").elem("field").mix("name").toClassName()}>{fullName || "—"}</div>
                  <div className={cn("people-list").elem("field").mix("phone").toClassName()}>{u.phone || "—"}</div>
                  <div className={cn("people-list").elem("field").mix("role").toClassName()}>
                    {ROLE_LABELS[primaryRole] ?? primaryRole}
                  </div>
                  <div className={cn("people-list").elem("field").mix("last-activity").toClassName()} data-i18n-skip>
                    {u.last_activity
                      ? formatDistance(new Date(u.last_activity), new Date(), {
                          addSuffix: true,
                          locale: getLang() === "zh-CN" ? zhCN : undefined,
                        })
                      : "—"}
                  </div>
                  <div className={cn("people-list").elem("field").mix("orgs").toClassName()}>
                    {u.memberships?.map((m) => m.organization_title).join(", ") || "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
