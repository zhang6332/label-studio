import { useCallback, useEffect, useState } from "react";
import { Spinner } from "../../../components";
import { useAPI } from "../../../providers/ApiProvider";
import { cn } from "../../../utils/bem";
import "./PeopleList.scss";

const ROLE_LABELS = {
  owner: "Owner",
  manager: "Manager",
  reviewer: "Reviewer",
  annotator: "Annotator",
};

/**
 * Cross-organization (system-wide) user list.
 * Calls GET /api/organizations/all-users and renders every user with all
 * their organization memberships and roles.
 */
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
            <div className={cn("people-list").elem("column").mix("email").toClassName()}>Email</div>
            <div className={cn("people-list").elem("column").mix("name").toClassName()}>Name</div>
            <div className={cn("people-list").elem("column").mix("role").toClassName()}>Organizations & Roles</div>
          </div>
          <div className={cn("people-list").elem("body").toClassName()}>
            {users.map((u) => {
              const active = u.id === selectedUser?.id;
              return (
                <div
                  key={`alluser-${u.id}`}
                  className={cn("people-list").elem("user").mod({ active }).toClassName()}
                  onClick={() =>
                    onSelect?.({
                      id: u.id,
                      email: u.email,
                      first_name: u.first_name,
                      last_name: u.last_name,
                      role: u.memberships?.[0]?.role,
                      memberships: u.memberships,
                    })
                  }
                  style={{ minHeight: 48, flexWrap: "wrap" }}
                >
                  <div className={cn("people-list").elem("field").mix("email").toClassName()}>{u.email}</div>
                  <div className={cn("people-list").elem("field").mix("name").toClassName()}>
                    {u.first_name} {u.last_name}
                  </div>
                  <div
                    className={cn("people-list").elem("field").toClassName()}
                    style={{ flex: 1, flexWrap: "wrap", gap: 4 }}
                  >
                    {u.memberships?.map((m, i) => (
                      <span
                        key={i}
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          marginRight: 4,
                          borderRadius: 12,
                          fontSize: 12,
                          background: "var(--color-neutral-emphasis-subtle, #f0f0f0)",
                          color: "var(--color-neutral-content-subtler, #666)",
                        }}
                      >
                        {m.organization_title} · {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    ))}
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
