"use client";

import { useActionState, useState } from "react";
import { onboardingAction, type OnboardingState } from "./actions";

const initialState: OnboardingState = {};

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(onboardingAction, initialState);
  const [copied, setCopied] = useState(false);

  if (state.result) {
    const { apiKey, orgName, projectName, environmentName } = state.result;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6">
        <div>
          <h1 className="text-xl font-semibold">You&apos;re set up</h1>
          <p className="text-sm text-gray-500">
            Org <strong>{orgName}</strong>, project <strong>{projectName}</strong>, environment{" "}
            <strong>{environmentName}</strong>.
          </p>
        </div>
        <div className="rounded border p-4">
          <p className="mb-2 text-sm font-medium">Your API key (shown once — store it now)</p>
          <code className="block break-all rounded bg-gray-100 px-3 py-2 text-sm">{apiKey}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(apiKey);
              setCopied(true);
            }}
            className="mt-3 rounded border px-3 py-1.5 text-sm"
          >
            {copied ? "Copied" : "Copy key"}
          </button>
        </div>
        <div className="rounded border p-4 text-sm">
          <p className="mb-2 font-medium">Try it</p>
          <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-xs">
{`curl -H "Authorization: Bearer ${apiKey}" http://localhost:3000/api/v1/whoami`}
          </pre>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-xl font-semibold">Set up your workspace</h1>
        <p className="text-sm text-gray-500">Create an organization and your first project.</p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Organization name
          <input name="orgName" type="text" required className="rounded border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Project name
          <input name="projectName" type="text" required defaultValue="Default project" className="rounded border px-3 py-2" />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create workspace"}
        </button>
      </form>
    </main>
  );
}
