import { Button } from "@humansignal/ui";
import { useCallback, useMemo, useRef, useState } from "react";
import { useUpdatePageTitle } from "@humansignal/core";
import { HeidiTips } from "../../../components/HeidiTips/HeidiTips";
import { modal } from "../../../components/Modal/Modal";
import { Space } from "../../../components/Space/Space";
import { cn } from "../../../utils/bem";
import { FF_AUTH_TOKENS, FF_LSDV_E_297, isFF } from "../../../utils/feature-flags";
import "./PeopleInvitation.scss";
import { PeopleList } from "./PeopleList";
import { AllUsersList } from "./AllUsersList";
import "./PeoplePage.scss";
import { TokenSettingsModal } from "@humansignal/app-common/blocks/TokenSettingsModal";
import { IconPlus } from "@humansignal/icons";
import { useToast } from "@humansignal/ui";
import { InviteLink } from "./InviteLink";
import { SelectedUser } from "./SelectedUser";
import { CreateUserModal } from "./CreateUserModal";
import { useAuth } from "@humansignal/core/providers/AuthProvider";

export const PeoplePage = () => {
  const apiSettingsModal = useRef();
  const toast = useToast();
  const [selectedUser, setSelectedUser] = useState(null);
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [memberListKey, setMemberListKey] = useState(0);
  const [view, setView] = useState("current"); // "current" | "all"
  const auth = useAuth();
  // Owner = creator of the active org → can create manager/annotator.
  // Manager → backend restricts to annotator only.
  const isOwner = Boolean(auth.user) && auth.user.active_organization_meta?.email === auth.user.email;

  useUpdatePageTitle("People");

  const selectUser = useCallback(
    (user) => {
      setSelectedUser(user);

      localStorage.setItem("selectedUser", user?.id);
    },
    [setSelectedUser],
  );

  const handleRoleChanged = useCallback((userId, newRole) => {
    setSelectedUser((prev) => (prev && prev.id === userId ? { ...prev, role: newRole } : prev));
    setMemberListKey((k) => k + 1);
  }, []);

  const apiTokensSettingsModalProps = useMemo(
    () => ({
      title: "API Token Settings",
      style: { width: 480 },
      body: () => (
        <TokenSettingsModal
          onSaved={() => {
            toast.show({ message: "API Token settings saved" });
            apiSettingsModal.current?.close();
          }}
        />
      ),
    }),
    [],
  );

  const showApiTokenSettingsModal = useCallback(() => {
    apiSettingsModal.current = modal(apiTokensSettingsModalProps);
    __lsa("organization.token_settings");
  }, [apiTokensSettingsModalProps]);

  const defaultSelected = useMemo(() => {
    return localStorage.getItem("selectedUser");
  }, []);

  // Only Owner/Manager can manage users — Reviewer and Annotator cannot.
  // Reviewer's job is to review annotations, not manage users.
  const { permissions } = auth;
  const canManageUsers = isOwner || permissions.can("organizations.change");
  if (!canManageUsers) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--color-neutral-content-subtler, #999)",
        }}
      >
        You don&apos;t have permission to access this page.
      </div>
    );
  }

  return (
    <div className={cn("people").toClassName()}>
      <div className={cn("people").elem("controls").toClassName()}>
        <Space spread>
          <Space />

          <Space>
            <Button
              look="outlined"
              onClick={() => setView((v) => (v === "current" ? "all" : "current"))}
              aria-label="Toggle user list scope"
            >
              {view === "current" ? "All Users" : "Organization Users"}
            </Button>
            {isFF(FF_AUTH_TOKENS) && (
              <Button look="outlined" onClick={showApiTokenSettingsModal} aria-label="Show API token settings">
                API Tokens Settings
              </Button>
            )}
            <Button look="outlined" onClick={() => setCreateUserOpen(true)} aria-label="Create new user">
              Create User
            </Button>
            <Button look="outlined" onClick={() => setInvitationOpen(true)} aria-label="Invite users">
              Invite Users
            </Button>
          </Space>
        </Space>
      </div>
      <div className={cn("people").elem("content").toClassName()}>
        {view === "all" ? (
          <AllUsersList selectedUser={selectedUser} onSelect={(user) => selectUser(user)} />
        ) : (
          <PeopleList
            key={memberListKey}
            selectedUser={selectedUser}
            defaultSelected={defaultSelected}
            onSelect={(user) => selectUser(user)}
          />
        )}

        {selectedUser ? (
          <SelectedUser user={selectedUser} onClose={() => selectUser(null)} onRoleChanged={handleRoleChanged} />
        ) : (
          isFF(FF_LSDV_E_297) && <HeidiTips collection="organizationPage" />
        )}
      </div>
      <InviteLink
        opened={invitationOpen}
        onClosed={() => {
          console.log("hidden");
          setInvitationOpen(false);
        }}
      />

      <CreateUserModal
        opened={createUserOpen}
        onClosed={() => setCreateUserOpen(false)}
        onCreated={() => setMemberListKey((k) => k + 1)}
        requesterLevel={isOwner ? 4 : 3}
      />
    </div>
  );
};

PeoplePage.title = "People";
PeoplePage.path = "/";
