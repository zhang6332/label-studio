import { useEffect, useRef, useState } from "react";
import { Button, useToast } from "@humansignal/ui";
import { Modal } from "../../../components/Modal/ModalPopup";
import { Input, Select } from "../../../components/Form";
import { useAPI } from "../../../providers/ApiProvider";

const ALL_ROLES = [
  { value: "manager", label: "Manager" },
  { value: "reviewer", label: "Reviewer" },
  { value: "annotator", label: "Annotator" },
];

const ROLE_LEVEL: Record<string, number> = {
  owner: 4,
  manager: 3,
  reviewer: 2,
  annotator: 1,
};

export const CreateUserModal = ({
  opened,
  onClosed,
  onCreated,
  requesterLevel = 3, // default Manager; Owner passes 4
}: {
  opened: boolean;
  onClosed?: () => void;
  onCreated?: () => void;
  requesterLevel?: number;
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

  // Filter roles: only show roles strictly below the requester's level.
  const availableRoles = ALL_ROLES.filter((r) => ROLE_LEVEL[r.value] < requesterLevel);

  // Modal show/hide via ref (same pattern as InviteLink.tsx).
  useEffect(() => {
    if (modalRef.current && opened) {
      modalRef.current?.show?.();
    } else if (modalRef.current && (modalRef.current as any).visible) {
      modalRef.current?.hide?.();
    }
  }, [opened]);

  // Reset form + load orgs when opened.
  useEffect(() => {
    if (!opened) return;
    setEmail("");
    setPassword("");
    setRole(availableRoles[availableRoles.length - 1]?.value ?? "annotator");
    setSelectedOrgs([]);
    api
      .callApi("organizations", {})
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setOrgs(list.map((o: any) => ({ id: o.id, title: o.title })));
      })
      .catch(() => setOrgs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <Input
            type="text"
            placeholder="Email"
            value={email}
            onChange={(e: any) => setEmail(e.target.value)}
            autoComplete="off"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e: any) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Select
            placeholder="Role"
            value={role}
            onChange={(e: any) => setRole(e.target.value)}
            options={availableRoles.map((r) => ({ value: r.value, label: r.label }))}
          />
          <div>
            <div style={{ marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Organizations</div>
            {orgs.length === 0 && (
              <div style={{ opacity: 0.5, fontSize: 13 }}>Loading…</div>
            )}
            {orgs.map((org) => (
              <label
                key={org.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 0",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedOrgs.includes(org.id)}
                  onChange={() => toggleOrg(org.id)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
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
