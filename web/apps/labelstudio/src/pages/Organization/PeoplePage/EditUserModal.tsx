import { useEffect, useRef, useState } from "react";
import { Button, useToast } from "@humansignal/ui";
import { Modal } from "../../../components/Modal/ModalPopup";
import { Input } from "../../../components/Form";
import { useAPI } from "../../../providers/ApiProvider";
import { useAuth } from "@humansignal/core/providers/AuthProvider";
import { t } from "../../../i18n";

const ROLE_LEVEL: Record<string, number> = { owner: 4, manager: 3, reviewer: 2, annotator: 1 };

const ALL_ROLES = [
  { value: "manager", label: t("Manager") },
  { value: "reviewer", label: t("Reviewer") },
  { value: "annotator", label: t("Annotator") },
];

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  background: "var(--color-neutral-surface, #fff)",
  color: "var(--color-neutral-content, #1f1f1f)",
  border: "1px solid var(--color-neutral-border, #d1d5db)",
  borderRadius: 4,
};

// Edit modal for an existing user. Supports editing basic info, the in-org
// role, freezing (is_active), removing the user from the current org, and
// deleting the user. All mutations honour the backend hierarchy checks
// (can_manage_user), so the UI simply mirrors requesterLevel.
export const EditUserModal = ({
  opened,
  user,
  requesterLevel = 3,
  onClosed,
  onSaved,
  onDeleted,
}: {
  opened: boolean;
  user: any | null;
  requesterLevel?: number;
  onClosed?: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
}) => {
  const api = useAPI();
  const toast = useToast();
  const auth = useAuth();
  const modalRef = useRef<Modal>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("annotator");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Only roles strictly below the requester are assignable (no peers/superiors).
  const editableRoles = ALL_ROLES.filter((r) => ROLE_LEVEL[r.value] < requesterLevel);
  const orgId = auth.user?.active_organization;

  useEffect(() => {
    if (modalRef.current && opened) {
      modalRef.current?.show?.();
    } else if (modalRef.current && (modalRef.current as any).visible) {
      modalRef.current?.hide?.();
    }
  }, [opened]);

  // Sync form fields whenever a new user is opened (does NOT reset on every
  // keystroke — only when `user` or `opened` changes).
  useEffect(() => {
    if (!opened || !user) return;
    setName([user.first_name, user.last_name].filter(Boolean).join(" ").trim());
    setPhone(user.phone || "");
    setRole(user.role || "annotator");
    setIsActive(user.is_active !== false);
    setConfirmDelete(false);
  }, [opened, user]);

  const save = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await api.callApi("updateUser", {
        params: { pk: user.id },
        // Store the full name in first_name and clear last_name so the display
        // (first_name + last_name) never doubles up the surname on re-edit.
        body: { first_name: name, last_name: "", phone, is_active: isActive },
      });
      if (role !== user.role && orgId) {
        await api.callApi("updateMembership", {
          params: { pk: orgId, userPk: user.id },
          body: { role },
        });
      }
      toast.show({ message: t("User updated") });
      onSaved?.();
      modalRef.current?.hide?.();
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) {
        toast.show({ message: t("You don't have permission to edit this user."), type: "error" });
      } else {
        toast.show({ message: t("Failed to update user."), type: "error" });
      }
    } finally {
      setSaving(false);
    }
  };

  const removeFromOrg = async () => {
    if (!user || !orgId || saving) return;
    setSaving(true);
    try {
      await api.callApi("deleteMembership", { params: { pk: orgId, userPk: user.id } });
      toast.show({ message: t("User removed from organization") });
      onSaved?.();
      modalRef.current?.hide?.();
    } catch (e: any) {
      toast.show({ message: t("Failed to remove user from organization."), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await api.callApi("deleteUser", { params: { pk: user.id } });
      toast.show({ message: t("User deleted") });
      onDeleted?.();
      modalRef.current?.hide?.();
    } catch (e: any) {
      toast.show({ message: t("Failed to delete user."), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const destructiveBtn: React.CSSProperties = {
    color: "var(--color-negative-content, #dc2626)",
    borderColor: "var(--color-negative-border, #fecaca)",
  };

  return (
    <Modal
      ref={modalRef}
      title={t("Edit User")}
      opened={opened}
      style={{ width: 480 }}
      onHide={onClosed}
      bareFooter
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", padding: 12 }}>
          <Button look="outlined" style={destructiveBtn} onClick={() => setConfirmDelete(true)} disabled={saving}>
            {t("Delete User")}
          </Button>
          <div style={{ display: "flex", gap: 8 }}>
            <Button look="outlined" onClick={() => modalRef.current?.hide?.()}>
              {t("Cancel")}
            </Button>
            <Button onClick={save} waiting={saving}>
              {t("Save")}
            </Button>
          </div>
        </div>
      }
      body={
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
          <Input
            type="text"
            placeholder={t("Name")}
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            style={{ width: "100%" }}
          />
          <Input
            type="text"
            placeholder={t("Phone")}
            value={phone}
            onChange={(e: any) => setPhone(e.target.value)}
            style={{ width: "100%" }}
          />
          <Input type="text" placeholder={t("Email")} value={user?.email || ""} disabled style={{ width: "100%" }} />
          <div>
            <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 500 }}>{t("Role")}</div>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={selectStyle} aria-label={t("Role")}>
              {editableRoles.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            {t("Active (uncheck to freeze / disable login)")}
          </label>

          <div style={{ borderTop: "1px solid var(--color-neutral-border, #e5e7eb)", marginTop: 4, paddingTop: 12 }}>
            <Button look="outlined" onClick={removeFromOrg} disabled={saving} style={{ width: "100%" }}>
              {t("Remove from this organization")}
            </Button>
          </div>

          {confirmDelete && (
            <div
              style={{
                padding: 12,
                border: "1px solid var(--color-negative-border, #fecaca)",
                borderRadius: 6,
                background: "var(--color-negative-surface, #fef2f2)",
              }}
            >
              <div style={{ marginBottom: 8, fontSize: 13 }}>
                {t("This permanently deletes the user and cannot be undone.")}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button look="outlined" onClick={() => setConfirmDelete(false)} disabled={saving}>
                  {t("Cancel")}
                </Button>
                <Button look="primary" style={destructiveBtn} onClick={deleteUser} waiting={saving}>
                  {t("Delete")}
                </Button>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
};
