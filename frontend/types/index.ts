export type BackendHealth = {
  status: string;
  service: string;
  timestamp: string;
  database: "connected" | "disconnected";
  databaseNote: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: { id: string; name: string };
};
