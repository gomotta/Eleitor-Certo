import prisma from '../database/prisma';

export const UserRepository = {
  findByEmail: (email: string) =>
    prisma.usuarios.findUnique({ where: { email } }),

  findById: (id: string) =>
    prisma.usuarios.findUnique({ where: { id } }),

  create: (nome: string, email: string, senhaHash: string) =>
    prisma.usuarios.create({ data: { nome, email, senha_hash: senhaHash } }),

  delete: (id: string) =>
    prisma.usuarios.delete({ where: { id } }),
};
