import { useCallback, useEffect, useState } from "react";
import { Spinner } from "../../../components";
import { Userpic } from "@humansignal/ui";
import { CopyableTooltip } from "../../../components/CopyableTooltip/CopyableTooltip";
import { useAPI } from "../../../providers/ApiProvider";
import { cn } from "../../../utils/bem";
import "./PeopleList.scss";

const ROLE_LABELS = {
  owner: "Owner",
  manager: "Manager",
  reviewer: "Reviewer",
  annotator: "Annotator",
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
            <div className={cn("people-list").elem("column").mix("email").toClassName()}>Email</div>
            <div className={cn("people-list").elem("column").mix("role").toClassName()}>Organizations & Roles</div>
            <div className={cn("people-list").elem("column").mix("last-activity").toClassName()}>Role</div>
          </div>
          <div className={cn("people-list").elem("body").toClassName()}>
            {users.map((u) => {
              const active = u.id === selectedUser?.id;
              const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email;
              const primaryRole = u.memberships?.[0]?.role;
              const userObj = {
                id: u.id,
                email: u.email,
                first_name: u.first_name || "",
                last_name: u.last_name || "",
                role: primaryRole,
                memberships: u.memberships,
                avatar: u.avatar,
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
                  <div className={cn("people-list").elem("field").mix("role").toClassName()}>
                    {u.memberships?.map((m, i) => (
                      <span
                        key={i}
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          marginRight: 4,
                          borderRadius: 12,
                          fontSize: 12,
                          background: "var(--color-neutral-emphasis-subtle)",
                          color: "var(--color-neutral-content-subtler)",
                        }}
                      >
                        {m.organization_title} · {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    ))}
                  </div>
                  <div className={cn("people-list").elem("field").mix("last-activity").toClassName()}>
                    {ROLE_LABELS[primaryRole] ?? primaryRole}
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
