import path from "node:path";

function usesEphemeralFilesystem() {
  return Boolean(
    process.env.VERCEL ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.AWS_EXECUTION_ENV
  );
}

export function getRuntimeDir() {
  if (usesEphemeralFilesystem()) {
    return path.join(process.env.TMPDIR ?? "/tmp", "hellobrand-runtime");
  }

  return path.join(process.cwd(), ".runtime");
}

export function getRuntimePath(...segments: string[]) {
  return path.join(getRuntimeDir(), ...segments);
}
