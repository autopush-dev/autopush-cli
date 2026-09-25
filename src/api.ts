import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

/** Build an authenticated client, refusing plaintext HTTP (except localhost). */
export function createClient(api: string, token: string): AxiosInstance {
  const base = api.replace(/\/$/, '');
  const isLocal = /^https?:\/\/localhost(:\d+)?$/i.test(base);
  if (!base.startsWith('https://') && !isLocal) {
    throw new Error(`Refusing to use a non-HTTPS API base: ${base}`);
  }
  return axios.create({
    baseURL: base,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 120000,
  });
}

export interface WhoAmI {
  name: string;
  email: string;
}

export async function whoami(client: AxiosInstance): Promise<WhoAmI> {
  const res = await client.get('/api/cli/whoami');
  return (res.data?.data ?? res.data) as WhoAmI;
}

export interface SiteSummary {
  siteId: string;
  slug: string;
  name: string;
  url: string;
}

export async function listSites(client: AxiosInstance): Promise<SiteSummary[]> {
  const res = await client.get('/api/cli/sites');
  return (res.data?.data?.sites ?? res.data?.sites ?? []) as SiteSummary[];
}

export interface DeployResult {
  siteId: string;
  slug: string;
  url: string;
}

export interface DeployFields {
  siteId?: string;
  slug?: string;
  name?: string;
  message?: string;
}

export async function deploy(client: AxiosInstance, zip: Buffer, fields: DeployFields): Promise<DeployResult> {
  const form = new FormData();
  // Field name "file" matches the backend's uploadZip multer middleware.
  form.append('file', zip, { filename: 'site.zip', contentType: 'application/zip' });
  if (fields.siteId) form.append('siteId', fields.siteId);
  if (fields.slug) form.append('slug', fields.slug);
  if (fields.name) form.append('name', fields.name);
  if (fields.message) form.append('message', fields.message);

  const res = await client.post('/api/cli/deploy', form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return (res.data?.data ?? res.data) as DeployResult;
}
