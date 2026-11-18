"use client";

import { useActionState } from "react";
import { Button, errorTextClasses, inputClasses, labelClasses } from "@/components/brand";
import { saveMember, type MemberFormState } from "@/lib/members/actions";

export function MemberForm() {
  const [state, action, pending] = useActionState<MemberFormState, FormData>(saveMember, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[260px]">
        <label htmlFor="m-email" className={labelClasses}>
          Work email
        </label>
        <input
          id="m-email"
          name="email"
          type="email"
          required
          className={inputClasses}
          placeholder="firstname.lastname@hydraspecma.com"
        />
      </div>
      <div className="w-40">
        <label htmlFor="m-role" className={labelClasses}>
          Role
        </label>
        <select id="m-role" name="role" defaultValue="editor" className={inputClasses}>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Add or update"}
      </Button>
      {state.error && (
        <p role="alert" className={`${errorTextClasses} w-full`}>
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-xs text-status-green w-full">
          {state.ok}
        </p>
      )}
    </form>
  );
}
