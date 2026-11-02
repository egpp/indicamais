import { vi } from "vitest";

// Componente de servidor assíncrono (lê a sessão): os testes de página renderizam em jsdom, sem servidor.
vi.mock("@/app/_componentes/conta-do-menu", () => ({ ContaDoMenu: () => null }));
