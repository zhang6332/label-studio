import { useEffect, useRef, useState } from "react";
import { Button, useToast } from "@humansignal/ui";
import { Modal } from "../../../components/Modal/ModalPopup";
import { Input } from "../../../components/Form";
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
  requesterLevel = 3,
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("annotator");
  const [orgs, setOrgs] = useState<Array<{ id: number; title: string }>>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableRoles = ALL_ROLES.filter((r) => ROLE_LEVEL[r.value] < requesterLevel);

  useEffect(() => {
    if (modalRef.current && opened) {
      modalRef.current?.show?.();
    } else if (modalRef.current && (modalRef.current as any).visible) {
      modalRef.current?.hide?.();
    }
  }, [opened]);

  // Load orgs on first open only; do NOT reset form on every opened change
  // (so validation failures don't wipe user input).
  useEffect(() => {
    if (!opened) return;
    setErrors({});
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
    setErrors((prev) => ({ ...prev, orgs: "" }));
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const submit = async () => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Invalid email format (e.g. user@example.com)";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 4) {
      newErrors.password = "Password must be at least 4 characters";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (selectedOrgs.length === 0) {
      newErrors.orgs = "Select at least one organization";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Show first error as toast
      const firstError = Object.values(newErrors)[0];
      toast.show({ message: firstError, type: "error" });
      return; // Do NOT close modal, do NOT clear inputs
    }

    setSaving(true);
    setErrors({});
    try {
      await api.callApi("createUserWithOrgs", {
        body: { email, password, first_name: name, last_name: "", role, organization_ids: selectedOrgs },
      });
      toast.show({ message: `User ${email} created` });
      // Clear form only on success
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setName("");
      setSelectedOrgs([]);
      onCreated?.();
      modalRef.current?.hide?.();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to create user";
      toast.show({ message: typeof msg === "string" ? msg : "Failed to create user", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const errorStyle: React.CSSProperties = {
    color: "var(--color-negative-content, #dc2626)",
    fontSize: 12,
    marginTop: 2,
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
            placeholder="Name"
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            style={{ width: "100%" }}
          />
          <div>
            <Input
              type="text"
              placeholder="user@example.com"
              value={email}
              onChange={(e: any) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: "" }));
              }}
              autoComplete="off"
              style={{ width: "100%" }}
            />
            {errors.email && <div style={errorStyle}>{errors.email}</div>}
          </div>
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e: any) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: "" }));
              }}
              autoComplete="new-password"
              style={{ width: "100%" }}
            />
            {errors.password && <div style={errorStyle}>{errors.password}</div>}
          </div>
          <div>
            <Input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e: any) => {
                setConfirmPassword(e.target.value);
                setErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              autoComplete="new-password"
              style={{ width: "100%" }}
            />
            {errors.confirmPassword && <div style={errorStyle}>{errors.confirmPassword}</div>}
          </div>
          <div>
            <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Role</div>
            <div style={{ display: "flex", gap: 8 }}>
              {availableRoles.map((r) => (
                <label
                  key={r.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 5,
                    border: `2px solid ${role === r.value ? "var(--color-primary-base, #2563eb)" : "var(--color-neutral-border, #d1d5db)"}`,
                    background: role === r.value ? "var(--color-primary-emphasis-subtle, #eff6ff)" : "transparent",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: role === r.value ? 600 : 400,
                  }}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    style={{ width: 14, height: 14, cursor: "pointer" }}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Organizations</div>
            {orgs.length === 0 && <div style={{ opacity: 0.5, fontSize: 13 }}>Loading…</div>}
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
            {errors.orgs && <div style={errorStyle}>{errors.orgs}</div>}
          </div>
        </div>
      }
    />
  );
};
