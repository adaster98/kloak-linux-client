class KloakAddonAPI {
  constructor() {
    this.userID = null;
    this.xHash = null;
    this.apiKey = null;
    this.authToken = null;
    this.userProfile = null;
    this.currentServerID = null; // Track current server
    this.currentServerName = null; // Track current server name
    this.currentDMStatus = false; // Track if user is in DMs
    this._serverMap = new Map(); // Cache of server ID -> Name
    this._readyCallbacks = [];
    this.isReady = false;
    this._isFetching = false;

    if (window.electronAPI && window.electronAPI.log) {
      window.electronAPI.log("Kloak Addons API: Initializing...");
    }

    this.settings = {
      get: async (addonId) => {
        if (window.electronAPI && window.electronAPI.getAddonConfig) {
          return await window.electronAPI.getAddonConfig(addonId);
        }
        return {};
      },
      set: (addonId, data) => {
        if (window.electronAPI && window.electronAPI.saveAddonConfig) {
          window.electronAPI.saveAddonConfig({ addonId, data });
        }
      },
    };

    this.fs = {
      read: async (addonId, filePath) => {
        return await window.electronAPI.readAddonFile(addonId, filePath);
      },
      write: async (addonId, filePath, data) => {
        return await window.electronAPI.writeAddonFile(addonId, filePath, data);
      },
      list: async (addonId, subDir = "") => {
        return await window.electronAPI.listAddonFiles(addonId, subDir);
      },
      delete: async (addonId, filePath) => {
        return await window.electronAPI.deleteAddonFile(addonId, filePath);
      },
      exists: async (addonId, filePath) => {
        return await window.electronAPI.addonFileExists(addonId, filePath);
      },
    };

    this._setupInterceptor();
  }

  onReady(callback) {
    if (typeof callback !== "function") return;
    if (this.isReady) {
      callback(this);
    } else {
      this._readyCallbacks.push(callback);
    }
  }

  _fireReady(isFinalAttempt = false) {
    if (this.isReady) return;

    // Be patient: If we don't have a server ID yet, wait up to 5 seconds
    // This allows the initial server context to be captured before addons load.
    if (!this.currentServerID && !isFinalAttempt && this.userID) {
      if (!this._serverWaitTimeout) {
        if (window.electronAPI && window.electronAPI.log) {
          window.electronAPI.log(
            "Kloak Addons API: Waiting up to 1s for server context...",
          );
        }
        this._serverWaitTimeout = setTimeout(() => {
          this._serverWaitTimeout = null;
          this._fireReady(true);
        }, 1000);
      }
      return;
    }

    if (this._serverWaitTimeout) {
      clearTimeout(this._serverWaitTimeout);
      this._serverWaitTimeout = null;
    }

    this.isReady = true;

    console.log("[Kloak Addon API] API Status Check (Ready):", {
      userID: this.userID,
      xHash: this.xHash,
      apiKey: this.apiKey,
      authToken: this.authToken,
      profileLoaded: !!this.userProfile,
      currentServerID: this.currentServerID,
      currentServerName: this.currentServerName,
      currentDMStatus: this.currentDMStatus,
    });

    if (window.electronAPI && window.electronAPI.log) {
      window.electronAPI.log("Kloak Addons API: Ready with user data");
      window.electronAPI.log(
        `[Kloak Addon API] API Status Check - UserID: ${this.userID}, xHash: ${this.xHash}, apiKey: ${this.apiKey}, authToken: ${this.authToken}, server: ${this.currentServerName} (${this.currentServerID}), dm: ${this.currentDMStatus}`,
      );
    }
    this._readyCallbacks.forEach((cb) => cb(this));
    this._readyCallbacks = [];
  }

  async _fetchUserProfile() {
    if (!this.xHash || !this.apiKey || !this.authToken || this._isFetching)
      return;

    this._isFetching = true;
    try {
      if (window.electronAPI && window.electronAPI.log) {
        window.electronAPI.log(
          "Kloak Addons API: Manual profile fetch triggered",
        );
      }

      const headers = {
        "Content-Type": "application/json",
        "X-Key-Hash": this.xHash,
        apikey: this.apiKey,
        Authorization: this.authToken,
      };

      const response = await fetch(
        "https://foquucurnwpqcvgqukpz.supabase.co/rest/v1/rpc/login_user",
        {
          method: "POST",
          headers: headers,
          body: JSON.stringify({ _key_hash: this.xHash }),
        },
      );

      if (response.ok) {
        const bodyText = await response.text();
        if (bodyText) {
          const profileData = JSON.parse(bodyText);
          if (profileData && profileData.id) {
            this.userProfile = profileData;
            this.userID = profileData.id;
            this._fireReady();
          }
        }
      } else {
        const errorText = await response.text();
        console.error("Kloak Addon API: Profile fetch failed", errorText);
      }
    } catch (e) {
      if (window.electronAPI && window.electronAPI.log) {
        window.electronAPI.log(
          `Kloak Addons API ERROR fetchUserProfile: ${e.message}`,
        );
      }
    } finally {
      this._isFetching = false;
    }
  }

  _setupInterceptor() {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (...args) {
      const url =
        typeof args[0] === "string"
          ? args[0]
          : args[0] && args[0].url
            ? args[0].url
            : "";
      let options = args[1] || {};

      const isLoginUser = url.includes("login_user");
      const isPingHealth = url.includes("ping_health");
      const isUpdateProfile = url.includes("update-user-profile");
      const isGetServerChannels = url.includes("get_server_channels");
      const isGetUserServers = url.includes("get_user_servers");
      const isMarkDMRead = url.includes("mark_dm_read");

      let currentXHash = null;
      let currentApiKey = null;
      let currentAuthToken = null;

      try {
        if (options.headers) {
          if (options.headers instanceof Headers) {
            currentXHash =
              options.headers.get("X-Key-Hash") ||
              options.headers.get("x-key-hash");
            currentApiKey =
              options.headers.get("apikey") || options.headers.get("apiKey");
            currentAuthToken =
              options.headers.get("Authorization") ||
              options.headers.get("authorization");
          } else {
            currentXHash =
              options.headers["X-Key-Hash"] || options.headers["x-key-hash"];
            currentApiKey =
              options.headers["apikey"] || options.headers["apiKey"];
            currentAuthToken =
              options.headers["Authorization"] ||
              options.headers["authorization"];
          }
        }
      } catch (e) {}

      if (currentApiKey && !self.apiKey) self.apiKey = currentApiKey;
      if (currentAuthToken && !self.authToken)
        self.authToken = currentAuthToken;
      if (currentXHash && !self.xHash) self.xHash = currentXHash;

      if (isGetServerChannels && options.body) {
        try {
          const body = JSON.parse(options.body);
          if (body._server_id && body._server_id !== self.currentServerID) {
            self.currentServerID = body._server_id;
            self.currentServerName =
              self._serverMap.get(self.currentServerID) || "Unknown Server";
            self.currentDMStatus = false;

            console.log(
              `[Kloak Addon API] Server Switched: ${self.currentServerName} (${self.currentServerID})`,
            );
            if (window.electronAPI && window.electronAPI.log) {
              window.electronAPI.log(
                `Kloak Addons API: Server Switched to ${self.currentServerName}`,
              );
            }

            // Trigger ready state early if we were waiting for the server context
            if (self.userID && !self.isReady) {
              self._fireReady();
            }
          }
        } catch (e) {
          console.error("AddonAPI Failed to parse get_server_channels body", e);
        }
      }

      if (isMarkDMRead) {
        if (!self.currentDMStatus) {
          self.currentDMStatus = true;
          self.currentServerID = null;
          self.currentServerName = null;
          console.log("[Kloak Addon API] Switched to Direct Messages");
          if (window.electronAPI && window.electronAPI.log) {
            window.electronAPI.log("Kloak Addons API: Switched to DMs");
          }
        }
      }

      // If we have everything and haven't fetched profile yet, do it now.
      // This covers ping_health or any other early request that might have keys.
      if (
        self.xHash &&
        self.apiKey &&
        self.authToken &&
        !self.userProfile &&
        !self._isFetching &&
        !isLoginUser // Don't conflict if a login_user is already in flight naturally
      ) {
        self._fetchUserProfile();
      }

      if (isUpdateProfile) {
        setTimeout(() => self._fetchUserProfile(), 1500);
      }

      const response = await originalFetch.apply(this, args);

      // Refresh server list cache
      if (isGetUserServers && response.ok) {
        try {
          const clone = response.clone();
          const items = await clone.json();
          if (Array.isArray(items)) {
            items.forEach((srv) => {
              if (srv.id && srv.name) self._serverMap.set(srv.id, srv.name);
            });
            // Update current server name if we just discovered it
            if (
              self.currentServerID &&
              self._serverMap.has(self.currentServerID)
            ) {
              self.currentServerName = self._serverMap.get(
                self.currentServerID,
              );
            }
          }
        } catch (e) {}
      }

      // Capture results from the client's own login_user request if it happened
      if (isLoginUser && response.ok) {
        try {
          const clone = response.clone();
          const bodyText = await clone.text();
          if (bodyText) {
            const profileData = JSON.parse(bodyText);
            if (profileData && profileData.id) {
              self.userProfile = profileData;
              self.userID = profileData.id;
              if (currentXHash) self.xHash = currentXHash;
              if (currentApiKey) self.apiKey = currentApiKey;
              if (currentAuthToken) self.authToken = currentAuthToken;
              self._fireReady();
            }
          }
        } catch (e) {
          console.error("AddonAPI Failed to parse login_user response", e);
        }
      }

      return response;
    };
  }
}

window.KloakAddonAPI = new KloakAddonAPI();
