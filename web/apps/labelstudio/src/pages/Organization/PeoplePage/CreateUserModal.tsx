import { useEffect, useRef, useState } from "react";
import { Button, useToast } from "@humansignal/ui";
import { Modal } from "../../../components/Modal/ModalPopup";
import { useAPI } from "../../../providers/ApiProvider";

const ROLE_OPTIONS = [
  { value: "annotator", label: "Annotator" },
  { value: "manager", label: "Manager" },
];

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--color-neutral-border, #ccc)",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

/**
 * Modal for creating a new user and assigning them to one or more
 * organizations with a role. Owner can create manager/annotator; Manager is
 * restricted to annotator by the backend (and we hide the option here when
 * canCreateManager is false).
 */
export const CreateUserModal = ({
  opened,
  onClosed,
  onCreated,
  canCreateManager = false,
}: {
  opened: boolean;
  onClosed?: () => void;
  onCreated?: () => void;
  canCreateManager?: boolean;
}) => {
  const api = useAPI();
  const toast = useToast();
  const modalRef = useRef<Modal>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("annotator");
  const [orgs, setOrgs] = useState<Array<{ id: number; title: string }>>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // Modal uses ref.show()/ref.hide() — opened prop alone is not enough
  // (same pattern as InviteLink.tsx). Without this, clicking "Create User"
  // sets state but the modal never appears.
  useEffect(() => {
    if (modalRef.current && opened) {
      modalRef.current?.show?.();
    } else if (modalRef.current && (modalRef.current as any).visible) {
      modalRef.current?.hide?.();
    }
  }, [opened]);

  useEffect(() => {
    if (!opened) return;
    setEmail("");
    setPassword("");
    setRole("annotator");
    setSelectedOrgs([]);
    api
      .callApi("organizations", {})
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setOrgs(list.map((o: any) => ({ id: o.id, title: o.title })));
      })
      .catch(() => setOrgs([]));
  }, [opened, api]);

  const toggleOrg = (id: number) => {
    setSelectedOrgs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    if (!email || !password) {
      toast.show({ message: "Email and password are required", type: "error" });
      return;
    }
    if (selectedOrgs.length === 0) {
      toast.show({ message: "Select at least one organization", type: "error" });
      return;
    }
    setSaving(true);
    try {
      await api.callApi("createUserWithOrgs", {
        body: { email, password, role, organization_ids: selectedOrgs },
      });
      toast.show({ message: `User ${email} created` });
      onCreated?.();
      modalRef.current?.hide?.();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to create user";
      toast.show({ message: typeof msg === "string" ? msg : "Failed to create user", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const roles = canCreateManager ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value === "annotator");

  return (
    <Modal
      ref={modalRef}
      title="Create User"
      opened={opened}
      style={{ width: 480 }}
      onHide={onClosed}
      bareFooter
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 12 }}>
          <Button look="outlined" onClick={() => modalRef.current?.hide?.()}>
            Cancel
          </Button>
          <Button onClick={submit} waiting={saving}>
            Create
          </Button>
        </div>
      }
      body={
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Email
            <input
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Password
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <div style={{ marginBottom: 4 }}>Organizations</div>
            {orgs.length === 0 && <div style={{ color: "#999", fontSize: 13 }}>Loading organizations…</div>}
            {orgs.map((org) => (
              <label key={org.id} style={{ display: "block", padding: "4px 0", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedOrgs.includes(org.id)}
                  onChange={() => toggleOrg(org.id)}
                  style={{ marginRight: 8 }}
                />
                {org.title}
              </label>
            ))}
          </div>
        </div>
      }
    />
  );
};
