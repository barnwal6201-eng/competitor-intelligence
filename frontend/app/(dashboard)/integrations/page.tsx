"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import Typography from "@mui/material/Typography";
import {
  disconnectIntegration,
  getIntegrationAuthorizeUrl,
  listIntegrations,
} from "@/services/integrations";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import type { IntegrationInfo, IntegrationProvider } from "@/types";

// Phase 10: the Integrations page — connect Notion and Salesforce with
// OAuth, see what is connected, and disconnect. The actual sign-in
// happens on the provider's own page (the Connect button is a plain link
// to the backend authorize URL); the backend callback stores the tokens
// encrypted and sends the browser back here with ?connected=<provider>.
// Pushing itself happens from a battlecard or a change, not from here.

const PROVIDER_META: Record<
  IntegrationProvider,
  { name: string; blurb: string; setup: string }
> = {
  notion: {
    name: "Notion",
    blurb:
      "Push a battlecard as a Notion page, or a detected change as a short page, under a page you choose. Your team reads it in Notion — no extra login.",
    setup:
      "Create a public integration at notion.so/my-integrations, then add NOTION_CLIENT_ID, NOTION_CLIENT_SECRET and NOTION_REDIRECT_URI to backend/.env and restart the backend. After connecting, share the parent page with the integration in Notion (page … → Add connections).",
  },
  salesforce: {
    name: "Salesforce",
    blurb:
      "Push a battlecard or a detected change as a Task on the rep's own activity timeline, so the warning shows up while they are working a deal — no Account needed.",
    setup:
      "Create a Connected App in Salesforce (Setup → App Manager) with the api + refresh_token scopes, then add SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET and SALESFORCE_REDIRECT_URI to backend/.env and restart the backend. A free Developer Edition org works for testing.",
  },
};

function errorText(code: string | null): string {
  switch (code) {
    case "notion-denied":
    case "salesforce-denied":
      return "The connection was cancelled on the provider's sign-in page — nothing was connected.";
    case "notion-failed":
      return "Notion refused the connection — check the integration's client id/secret and that its redirect URI matches NOTION_REDIRECT_URI.";
    case "salesforce-failed":
      return "Salesforce refused the connection — check the Connected App's client id/secret and that the callback URL is allow-listed there.";
    case "no-encryption-key":
      return "INTEGRATION_ENCRYPTION_KEY is not set — add it to backend/.env before connecting.";
    case "bad-state":
      return "The connection request expired — try connecting again.";
    default:
      return "The connection failed — try again.";
  }
}

export default function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectedParam = searchParams.get("connected");
  const errorParam = searchParams.get("error");
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<IntegrationProvider | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setIntegrations(await listIntegrations());
    } catch (err) {
      if (err instanceof Error && /not signed in/i.test(err.message)) {
        router.push("/login");
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Could not load integrations");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (connectedParam === "notion" || connectedParam === "salesforce") {
      setNotice(
        `${connectedParam === "notion" ? "Notion" : "Salesforce"} connected. Push a battlecard or a change from its page to send it there.`
      );
    } else if (errorParam) {
      setNoticeError(errorText(errorParam));
    }
  }, [connectedParam, errorParam]);

  async function handleDisconnect(provider: IntegrationProvider) {
    setWorking(provider);
    setNotice("");
    setNoticeError("");
    try {
      await disconnectIntegration(provider);
      setNotice(`${provider === "notion" ? "Notion" : "Salesforce"} disconnected.`);
      await load();
    } catch (err) {
      setNoticeError(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setWorking(null);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "text.secondary" }}>
        <CircularProgress size={18} /> Loading integrations…
      </Box>
    );
  }

  if (loadError) {
    return <EmptyState title="Could not load integrations" description={loadError} />;
  }

  return (
    <Box>
      <PageHeader
        title="Integrations"
        description="Connect the tools your sales team already uses, then push battlecards and detected changes into them from a battlecard or a change. Tokens are stored encrypted and are never shown here."
      />

      {notice ? (
        <Alert severity="success" sx={{ mt: 3 }}>{notice}</Alert>
      ) : null}
      {noticeError ? (
        <Alert severity="error" sx={{ mt: 3 }}>{noticeError}</Alert>
      ) : null}

      <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 2 }}>
        {(Object.keys(PROVIDER_META) as IntegrationProvider[]).map((provider) => {
          const info = integrations.find((i) => i.provider === provider);
          const meta = PROVIDER_META[provider];
          const connected = !!info?.connected;
          return (
            <Card key={provider}>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 2, p: 2.5 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{meta.name}</Typography>
                    <Badge tone={connected ? "green" : "neutral"}>
                      {connected ? "Connected" : "Not connected"}
                    </Badge>
                    {!info?.configured ? <Badge tone="amber">Not configured</Badge> : null}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.6 }}>
                    {meta.blurb}
                  </Typography>
                  {connected && info?.externalAccountName ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      Workspace: <Typography component="span" sx={{ fontWeight: 600, color: "text.primary" }}>{info.externalAccountName}</Typography>
                    </Typography>
                  ) : null}
                  {connected && info?.externalAccountId && !info?.externalAccountName ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      Account: <Typography component="span" sx={{ fontWeight: 600, color: "text.primary" }}>{info.externalAccountId}</Typography>
                    </Typography>
                  ) : null}
                  {connected && info?.lastPushAt ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      Last push: {info.lastPushTarget ?? info.lastPushKind} ·{" "}
                      {new Date(info.lastPushAt).toLocaleString()}
                    </Typography>
                  ) : null}
                  {provider === "notion" && info?.notionParentPageId ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      Parent page id:{" "}
                      <Typography component="span" sx={{ fontFamily: "monospace", fontSize: "0.8rem", color: "text.primary" }}>
                        {info.notionParentPageId}
                      </Typography>
                    </Typography>
                  ) : null}
                  {!info?.configured ? (
                    <Alert severity="warning" sx={{ mt: 1.5 }}>{meta.setup}</Alert>
                  ) : null}
                </Box>
                <Box sx={{ display: "flex", flexShrink: 0, gap: 1 }}>
                  {connected ? (
                    <Button
                      onClick={() => handleDisconnect(provider)}
                      disabled={working === provider}
                      variant="outlined"
                      startIcon={<LinkOffIcon />}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      href={getIntegrationAuthorizeUrl(provider)}
                      variant="contained"
                      startIcon={<LinkIcon />}
                      disabled={!info?.configured}
                    >
                      Connect {meta.name}
                    </Button>
                  )}
                </Box>
              </Box>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
