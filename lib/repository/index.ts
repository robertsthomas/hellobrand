import { FileRepository } from "@/lib/repository/file-repository";
import { PrismaRepository } from "@/lib/repository/prisma-repository";

const repository = process.env.DATABASE_URL
  ? new PrismaRepository()
  : new FileRepository();

export function getRepository() {
  return repository;
}
