import path from "path";
import fs from "fs";
import { envsubst } from "./lib/utils";

export class KeyCloak {
  #baseUrl: string;
  #realm: string;

  constructor(baseUrl: string, realm: string) {
    this.#baseUrl = baseUrl;
    this.#realm = realm;
  }

  public async createClient(token: string, client: any) {
    const id = await this.getClientIdByClientId(token, client.clientId);
    if (id) return id;

    const res = await fetch(
      `${this.#baseUrl}/admin/realms/${this.#realm}/clients`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(client),
      },
    );

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }

    const clientId = await this.getClientIdByClientId(token, client.clientId);
    if (!clientId) throw new Error("Failed to get client ID");
    return clientId;
  }

  public async getClientIdByClientId(
    token: string,
    clientId: string,
  ): Promise<string | null> {
    const res = await fetch(
      `${this.#baseUrl}/admin/realms/${this.#realm}/clients`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }

    const clients = await res.json();
    const match = clients.find((c: any) => c.clientId === clientId);
    return match?.id || null;
  }

  public async getServiceAccountUserId(
    token: string,
    clientId: string,
  ): Promise<string | null> {
    const res = await fetch(
      `${this.#baseUrl}/admin/realms/${this.#realm}/clients/${clientId}/service-account-user`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }

    const user = await res.json();
    return user?.id || null;
  }

  public async getRoleId(
    token: string,
    clientId: string,
    roleName: string,
  ): Promise<string | null> {
    const res = await fetch(
      `${this.#baseUrl}/admin/realms/${this.#realm}/clients/${clientId}/roles`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }

    const roles = await res.json();
    const match = roles.find((r: any) => r.name === roleName);
    return match?.id || null;
  }

  public async assignRolesToServiceAccount(
    token: string,
    userId: string,
    clientId: string,
    roles: { id: string; name: string }[],
  ) {
    const res = await fetch(
      `${this.#baseUrl}/admin/realms/${this.#realm}/users/${userId}/role-mappings/clients/${clientId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(roles),
      },
    );

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }
  }

  public async createUserByUsername(token: string, username: string) {
    const res = await fetch(
      `${this.#baseUrl}/admin/realms/${
        this.#realm
      }/users?username=${encodeURIComponent(username)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  }

  public async createUserIfNotExists(
    token: string,
    username: string,
    userPayload: any,
  ) {
    const users = await this.createUserByUsername(token, username);
    if (users.length === 0) {
      console.log(`Creating user ${username}`);

      const createRes = await fetch(
        `${this.#baseUrl}/admin/realms/${this.#realm}/users`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userPayload),
        },
      );

      if (createRes.ok) {
        const _users = await this.createUserByUsername(token, username);

        console.log(`User ${username} created.`);
        return _users.find((u: any) => u.username === username).id;
      } else {
        console.log(`Failed to create user ${username}`);
        return null;
      }
    } else {
      console.log(`User ${username} already exists.`);
      return users.find((u: any) => u.username === username).id;
    }
  }

  public async getToken(info: any, realm: string) {
    if (!info) throw new Error("Info is required");

    const response = await fetch(
      `${this.#baseUrl}/realms/${realm}/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(info),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to get token");
    }

    return await response.json();
  }

  public async clientExists(token: string, clientId: string): Promise<boolean> {
    const id = await this.getClientIdByClientId(token, clientId);
    return !!id;
  }

  public async realmExists(token: string, realm: string) {
    const res = await fetch(`${this.#baseUrl}/admin/realms/${realm}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  }

  public async importRealm(token: string, dir: string) {
    const realmTemplate = fs.readFileSync(
      path.resolve(dir, "realm-config", "openldr-realm.json"),
      "utf-8",
    );
    const finalRealm = envsubst(realmTemplate);
    const res = await fetch(`${this.#baseUrl}/admin/realms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: finalRealm,
    });
    if (!res.ok) throw new Error(`Realm import failed: ${res.statusText}`);

    const response = await fetch(
      `${this.#baseUrl}/admin/realms/${this.#realm}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attributes: {
            frontendUrl: this.#baseUrl,
          },
        }),
      },
    );
    if (!response.ok)
      throw new Error(`Realm updating failed: ${res.statusText}`);
    console.log("Realm imported.");
  }
}
