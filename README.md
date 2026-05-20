# TGWeb - Sistema de Gestão de Frota com Integração WhatsApp

![Badge React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Badge TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Badge Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Badge Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

> Sistema web completo para gerenciamento de frota de veículos, motoristas, programações e comunicação automática via WhatsApp.

## ✨ Funcionalidades Principais

- Cadastro e gestão de motoristas e veículos
- Programação de rotas e serviços
- **Integração nativa com WhatsApp** (envio automático de mensagens, notificações)
- Mapa em tempo real com rastreamento (Leaflet)
- Autenticação segura com Firebase
- Interface responsiva e moderna

## 🛠️ Tecnologias Utilizadas

**Frontend:**
- React + TypeScript + Vite
- React Leaflet (mapas)
- Socket.io (comunicação em tempo real)

**Backend:**
- Node.js + Express
- Socket.io
- whatsapp-web.js

**Banco de Dados & Infra:**
- Firebase (Auth + Firestore)
- Deploy pronto para Firebase Hosting

## 📸 Screenshots / Demonstração

*(Insira aqui 4-6 imagens ou GIFs)*

![Dashboard](link-da-imagem)
![Mapa em tempo real](link-da-imagem)
![Integração WhatsApp](link-da-imagem)

## 🚀 Como Rodar o Projeto Localmente

```bash
# 1. Clone o repositório
git clone https://github.com/rafinhass853-stack/tgweb.git
cd tgweb

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# → Edite o .env com suas chaves do Firebase

# 4. Rode o projeto (frontend + backend juntos)
npm run dev:all
