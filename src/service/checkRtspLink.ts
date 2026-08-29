import * as crypto from 'crypto';
import * as net from 'net';
import * as url from 'url';
import { promises as dns } from 'dns';

function generateDigestResponse(username: string, password: string, realm: string, nonce: string, uri: string): string {
    const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
    const ha2 = crypto.createHash('md5').update(`DESCRIBE:${uri}`).digest('hex');
    return crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
}

// Blocks connections to private/loopback/link-local/reserved network ranges so a
// submitted rtspUrl can't be used to make this server probe or reach our own
// internal infrastructure (SSRF). Legitimate cameras are reachable on the public
// internet (via a public IP or DDNS hostname), so this doesn't affect them.
function isDisallowedIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const parts = ip.split('.').map(Number);
        const [a, b] = parts;
        if (a === 10) return true; // 10.0.0.0/8
        if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
        if (a === 192 && b === 168) return true; // 192.168.0.0/16
        if (a === 127) return true; // loopback
        if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
        if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
        if (a === 0) return true; // "this" network
        if (a >= 224) return true; // multicast + reserved 224.0.0.0/4, 240.0.0.0/4
        return false;
    }
    if (net.isIPv6(ip)) {
        const lower = ip.toLowerCase();
        if (lower === '::1') return true; // loopback
        if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (fc00::/7)
        const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isDisallowedIp(mapped[1]); // IPv4-mapped IPv6
        return false;
    }
    return true; // unrecognized format - fail closed
}

async function assertPublicHost(host: string): Promise<void> {
    const results = await dns.lookup(host, { all: true });
    if (results.length === 0) {
        throw new Error('Could not resolve RTSP host.');
    }
    for (const { address } of results) {
        if (isDisallowedIp(address)) {
            throw new Error('RTSP host resolves to a private/reserved network address.');
        }
    }
}

export function checkRtspLink(rtspUrl: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {

        const parsedUrl = url.parse(rtspUrl);

        if (!parsedUrl.protocol || parsedUrl.protocol.toLowerCase() !== 'rtsp:') {
            reject(new Error('Invalid protocol. Must be RTSP.'));
            return;
        }

        if (!parsedUrl.hostname) {
            reject(new Error('Invalid URL. Missing hostname.'));
            return;
        }

        const host = parsedUrl.hostname;
        const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 554;

        try {
            await assertPublicHost(host);
        } catch (err) {
            reject(err);
            return;
        }

        const auth = parsedUrl.auth ? parsedUrl.auth.split(':') : [];
        const username = auth[0] || '';
        const password = auth[1] || '';

        const socket = new net.Socket();
        socket.setTimeout(5000); // 5 seconds timeout

        let authAttempted = false;

        function sendRequest(authHeader = '') {
            const cseq = authAttempted ? '2' : '1';
            const request = `DESCRIBE ${rtspUrl} RTSP/1.0\r\n` +
                `CSeq: ${cseq}\r\n` +
                `User-Agent: LibVLC/3.0.8 (LIVE555 Streaming Media v2018.02.18)\r\n` +
                `Accept: application/sdp\r\n` +
                authHeader +
                '\r\n';
            socket.write(request);
        }

        socket.connect(port, host, () => {
            sendRequest();
        });

        let response = '';

        socket.on('data', (data) => {
            response += data.toString();

            if (response.includes('RTSP/1.0 200 OK')) {
                socket.destroy();
                resolve(true);
            } else if (response.includes('RTSP/1.0 401 Unauthorized') && !authAttempted) {
                const wwwAuthHeaders = response.split('\n').filter(line => line.startsWith('WWW-Authenticate:'));
                const digestHeader = wwwAuthHeaders.find(header => header.includes('Digest'));
                const realm = digestHeader?.match(/realm="([^"]+)"/)?.[1];
                const nonce = digestHeader?.match(/nonce="([^"]+)"/)?.[1];

                if (realm && nonce && username && password) {
                    const digestResponse = generateDigestResponse(username, password, realm, nonce, rtspUrl);
                    const authHeader = `Authorization: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${rtspUrl}", response="${digestResponse}"\r\n`;
                    authAttempted = true;
                    response = '';
                    sendRequest(authHeader);
                } else {
                    socket.destroy();
                    resolve(false);
                }
            } else {
                socket.destroy();
                resolve(false);
            }
        });

        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Connection timed out'));
        });

        socket.on('error', (err) => {
            socket.destroy();
            reject(err);
        });

        socket.on('close', () => {
            if (!response.includes('RTSP/1.0 200 OK')) {
                resolve(false);
            }
        });
    });
}
