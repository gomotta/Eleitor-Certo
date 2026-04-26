import 'dotenv/config';
import prisma from '../prisma';
import bcrypt from 'bcrypt';

async function main() {
  const email = 'gustavo.motta@eleitorcerto.com.br';
  const password = '#Ed1035ta!';
  const nome = 'Gustavo Motta';

  const existing = await prisma.usuarios.findUnique({ where: { email } });
  if (existing) {
    console.log(`[create-user] Usuário já existe: ${email} (id: ${existing.id})`);
    return;
  }

  const senhaHash = await bcrypt.hash(password, 12);
  const user = await prisma.usuarios.create({
    data: { nome, email, senha_hash: senhaHash },
  });
  console.log(`[create-user] Usuário criado: ${user.email} (id: ${user.id})`);
}

main()
  .catch((err) => { console.error('[create-user] Erro:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
