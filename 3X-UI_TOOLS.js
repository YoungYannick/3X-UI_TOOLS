// ==UserScript==
// @name         3X-UI多功能脚本
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  3X-UI一键生成节点 (VLESS/VMESS/SS) & 一键关闭订阅访问 & 一键添加出站规则 & 一键配置路由规则 & 一键配删除入站节点 & 节点链接展示
// @icon         https://avatars.githubusercontent.com/u/86963023
// @author       Yannick Young
// @match        *://*/*/panel/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    class NodeGenerator {
      constructor(options = {}) {
        this.address = options.address || '';
        this.showInfo = options.showInfo !== false;
        this.remarkModel = options.remarkModel || '-ieo';
      }

      generateLinks(inbound, address) {
        this.address = address || this.address;
        const links = [];
        try {
          const settings = JSON.parse(inbound.settings);
          const streamSettings = JSON.parse(inbound.streamSettings);
          const clients = settings.clients || [];
          if (inbound.protocol === 'shadowsocks' && clients.length === 0) {
            const method = settings.method || '';
            if (method.startsWith('2022-')) {
              const virtualClient = {
                enable: true,
                email: inbound.remark || `SS-${inbound.port}`,
                password: settings.password || ''
              };
              const link = this.getLink(inbound, virtualClient, streamSettings);
              if (link) {
                links.push(link);
              }
            }
          } else {
            clients.forEach(client => {
              if (client.enable) {
                const link = this.getLink(inbound, client, streamSettings);
                if (link) {
                  links.push(link);
                }
              }
            });
          }
        } catch (error) {
          console.error('生成链接失败:', error);
        }
        return links;
      }

      getLink(inbound, client, streamSettings) {
        switch (inbound.protocol) {
          case 'vmess':
            return this.genVmessLink(inbound, client, streamSettings);
          case 'vless':
            return this.genVlessLink(inbound, client, streamSettings);
          case 'trojan':
            return this.genTrojanLink(inbound, client, streamSettings);
          case 'shadowsocks':
            return this.genShadowsocksLink(inbound, client, streamSettings);
          default:
            return '';
        }
      }

      genVlessLink(inbound, client, stream) {
        const address = this.address;
        const port = inbound.port;
        const uuid = client.id;
        const streamNetwork = stream.network || 'tcp';
        const params = new URLSearchParams();
        params.set('type', streamNetwork);
        const settings = JSON.parse(inbound.settings);
        if (settings.encryption) {
          params.set('encryption', settings.encryption);
        }
        this.handleStreamSettings(stream, streamNetwork, params);
        this.handleSecurity(stream, params, client.flow);
        const externalProxies = stream.externalProxy || [];
        if (externalProxies.length > 0) {
          return this.genMultipleLinks('vless', uuid, externalProxies, params, inbound, client.email, stream, client.flow);
        }
        let link = `vless://${uuid}@${address}:${port}`;
        const url = new URL(link);
        params.forEach((value, key) => {
          url.searchParams.set(key, value);
        });
        url.hash = this.genRemark(inbound, client.email, '');
        return url.toString();
      }

      genVmessLink(inbound, client, stream) {
        const externalProxies = stream.externalProxy || [];
        if (externalProxies.length > 0) {
          return this.genVmessMultipleLinks(obj, externalProxies, inbound, client.email, security);
        }
        const obj = {
          v: '2',
          ps: this.genRemark(inbound, client.email, ''),
          add: this.address,
          port: inbound.port,
          id: client.id,
          scy: client.security || ''
        };
        const streamNetwork = stream.network || 'tcp';
        obj.net = streamNetwork;
        const security = stream.security || 'none';
        obj.tls = security;
        switch (streamNetwork) {
          case 'tcp':
            this.handleVmessTcp(stream, obj);
            break;
          case 'kcp':
            this.handleVmessKcp(stream, obj);
            break;
          case 'ws':
            this.handleVmessWs(stream, obj);
            break;
          case 'grpc':
            this.handleVmessGrpc(stream, obj);
            break;
          case 'httpupgrade':
            this.handleVmessHttpUpgrade(stream, obj);
            break;
          case 'xhttp':
            this.handleVmessXhttp(stream, obj);
            break;
        }
        if (security === 'tls') {
          this.handleVmessTls(stream, obj);
        }
        const jsonStr = JSON.stringify(obj, null, 2);
        return 'vmess://' + btoa(jsonStr);
      }

      genTrojanLink(inbound, client, stream) {
        const address = this.address;
        const port = inbound.port;
        const password = client.password;
        const streamNetwork = stream.network || 'tcp';
        const params = new URLSearchParams();
        params.set('type', streamNetwork);
        this.handleStreamSettings(stream, streamNetwork, params);
        this.handleSecurity(stream, params, client.flow);
        const externalProxies = stream.externalProxy || [];
        if (externalProxies.length > 0) {
          return this.genMultipleLinks('trojan', password, externalProxies, params, inbound, client.email, stream, client.flow);
        }
        let link = `trojan://${password}@${address}:${port}`;
        const url = new URL(link);
        params.forEach((value, key) => {
          url.searchParams.set(key, value);
        });
        url.hash = this.genRemark(inbound, client.email, '');
        return url.toString();
      }

      genShadowsocksLink(inbound, client, stream) {
        const address = this.address;
        const port = inbound.port;
        const settings = JSON.parse(inbound.settings);
        const method = settings.method;
        const inboundPassword = settings.password || '';
        let encPart = `${method}:${client.password}`;
        if (method && method.startsWith('2022-')) {
          if (client.password === inboundPassword) {
            encPart = `${method}:${inboundPassword}`;
          } else {
            encPart = `${method}:${inboundPassword}:${client.password}`;
          }
        }
        const streamNetwork = stream.network || 'tcp';
        const params = new URLSearchParams();
        params.set('type', streamNetwork);
        this.handleStreamSettings(stream, streamNetwork, params);
        const security = stream.security || 'none';
        if (security === 'tls') {
          this.handleTlsParams(stream, params);
        }
        const externalProxies = stream.externalProxy || [];
        if (externalProxies.length > 0) {
          return this.genSsMultipleLinks(encPart, externalProxies, params, inbound, client.email, security, stream);
        }
        const encodedPart = btoa(encPart).replace(/=+$/, '');
        let link = `ss://${encodedPart}@${address}:${port}`;
        const url = new URL(link);
        params.forEach((value, key) => {
          url.searchParams.set(key, value);
        });
        url.hash = this.genRemark(inbound, client.email, '');
        return url.toString();
      }

      handleStreamSettings(stream, streamNetwork, params) {
        switch (streamNetwork) {
          case 'tcp':
            this.handleTcp(stream, params);
            break;
          case 'kcp':
            this.handleKcp(stream, params);
            break;
          case 'ws':
            this.handleWs(stream, params);
            break;
          case 'grpc':
            this.handleGrpc(stream, params);
            break;
          case 'httpupgrade':
            this.handleHttpUpgrade(stream, params);
            break;
          case 'xhttp':
            this.handleXhttp(stream, params);
            break;
        }
      }

      handleTcp(stream, params) {
        const tcp = stream.tcpSettings || {};
        const header = tcp.header || {};
        const typeStr = header.type || 'none';
        if (typeStr === 'http') {
          const request = header.request || {};
          const requestPath = request.path || [];
          if (requestPath.length > 0) {
            params.set('path', requestPath[0]);
          }
          const headers = request.headers || {};
          const host = this.searchHost(headers);
          if (host) {
            params.set('host', host);
          }
          params.set('headerType', 'http');
        }
      }

      handleKcp(stream, params) {
        const kcp = stream.kcpSettings || {};
        const header = kcp.header || {};
        if (header.type) {
          params.set('headerType', header.type);
        }
        if (kcp.seed) {
          params.set('seed', kcp.seed);
        }
      }

      handleWs(stream, params) {
        const ws = stream.wsSettings || {};
        if (ws.path) {
          params.set('path', ws.path);
        }
        if (ws.host) {
          params.set('host', ws.host);
        } else {
          const headers = ws.headers || {};
          const host = this.searchHost(headers);
          params.set('host', host || '');
        }
      }

      handleGrpc(stream, params) {
        const grpc = stream.grpcSettings || {};
        if (grpc.serviceName) {
          params.set('serviceName', grpc.serviceName);
        }
        if (grpc.authority) {
          params.set('authority', grpc.authority);
        }
        if (grpc.multiMode) {
          params.set('mode', 'multi');
        }
      }

      handleHttpUpgrade(stream, params) {
        const httpupgrade = stream.httpupgradeSettings || {};
        if (httpupgrade.path) {
          params.set('path', httpupgrade.path);
        }
        if (httpupgrade.host) {
          params.set('host', httpupgrade.host);
        } else {
          const headers = httpupgrade.headers || {};
          const host = this.searchHost(headers);
          if (host) {
            params.set('host', host);
          }
        }
      }

      handleXhttp(stream, params) {
        const xhttp = stream.xhttpSettings || {};
        if (xhttp.path) {
          params.set('path', xhttp.path);
        }
        if (xhttp.host) {
          params.set('host', xhttp.host);
        } else {
          const headers = xhttp.headers || {};
          const host = this.searchHost(headers);
          params.set('host', host || '');
        }
        params.set('mode', xhttp.mode || 'auto');
      }

      handleSecurity(stream, params, flow) {
        const security = stream.security || 'none';
        if (security === 'tls') {
          params.set('security', 'tls');
          this.handleTlsParams(stream, params);
          if (flow && stream.network === 'tcp') {
            params.set('flow', flow);
          }
        } else if (security === 'reality') {
          params.set('security', 'reality');
          this.handleRealityParams(stream, params);
          if (flow && stream.network === 'tcp') {
            params.set('flow', flow);
          }
        } else {
          params.set('security', 'none');
        }
      }

      handleTlsParams(stream, params) {
        const tlsSetting = stream.tlsSettings || {};
        const alpns = tlsSetting.alpn || [];
        if (alpns.length > 0) {
          params.set('alpn', alpns.join(','));
        }
        if (tlsSetting.serverName) {
          params.set('sni', tlsSetting.serverName);
        }
        const settings = tlsSetting.settings || {};
        if (settings.fingerprint) {
          params.set('fp', settings.fingerprint);
        }
        if (settings.allowInsecure) {
          params.set('allowInsecure', '1');
        }
      }

      handleRealityParams(stream, params) {
        const realitySetting = stream.realitySettings || {};
        const settings = realitySetting.settings || {};
        if (settings.publicKey) {
          params.set('pbk', settings.publicKey);
        }
        if (settings.fingerprint) {
          params.set('fp', settings.fingerprint);
        }
        const serverNames = realitySetting.serverNames || [];
        if (serverNames.length > 0) {
          params.set('sni', serverNames[Math.floor(Math.random() * serverNames.length)]);
        }
        const rawShortIds = realitySetting.shortIds || [];
        const shortIds = rawShortIds
          .map(sid => String(sid))
          .filter(sid => sid.length > 0);
        if (shortIds.length > 0) {
          const sid = shortIds[Math.floor(Math.random() * shortIds.length)];
          params.set('sid', sid);
        }
        if (settings.spiderX) {
          params.set('spx', settings.spiderX);
        } else {
          params.set('spx', '/' + this.randomString(15));
        }
        if (settings.mldsa65Verify) {
          params.set('pqv', settings.mldsa65Verify);
        }
      }

      handleVmessTcp(stream, obj) {
        const tcp = stream.tcpSettings || {};
        const header = tcp.header || {};
        const typeStr = header.type || 'none';
        obj.type = typeStr;
        if (typeStr === 'http') {
          const request = header.request || {};
          const requestPath = request.path || [];
          if (requestPath.length > 0) {
            obj.path = requestPath[0];
          }
          const headers = request.headers || {};
          obj.host = this.searchHost(headers);
        }
      }

      handleVmessKcp(stream, obj) {
        const kcp = stream.kcpSettings || {};
        const header = kcp.header || {};
        obj.type = header.type || 'none';
        obj.path = kcp.seed || '';
      }

      handleVmessWs(stream, obj) {
        const ws = stream.wsSettings || {};
        obj.path = ws.path || '';
        if (ws.host) {
          obj.host = ws.host;
        } else {
          const headers = ws.headers || {};
          obj.host = this.searchHost(headers);
        }
      }

      handleVmessGrpc(stream, obj) {
        const grpc = stream.grpcSettings || {};
        obj.path = grpc.serviceName || '';
        obj.authority = grpc.authority || '';
        if (grpc.multiMode) {
          obj.type = 'multi';
        }
      }

      handleVmessHttpUpgrade(stream, obj) {
        const httpupgrade = stream.httpupgradeSettings || {};
        obj.path = httpupgrade.path || '';
        if (httpupgrade.host) {
          obj.host = httpupgrade.host;
        } else {
          const headers = httpupgrade.headers || {};
          obj.host = this.searchHost(headers);
        }
      }

      handleVmessXhttp(stream, obj) {
        const xhttp = stream.xhttpSettings || {};
        obj.path = xhttp.path || '';
        if (xhttp.host) {
          obj.host = xhttp.host;
        } else {
          const headers = xhttp.headers || {};
          obj.host = this.searchHost(headers);
        }
        obj.mode = xhttp.mode || '';
      }

      handleVmessTls(stream, obj) {
        const tlsSetting = stream.tlsSettings || {};
        const alpns = tlsSetting.alpn || [];
        if (alpns.length > 0) {
          obj.alpn = alpns.join(',');
        }
        if (tlsSetting.serverName) {
          obj.sni = tlsSetting.serverName;
        }

        const settings = tlsSetting.settings || {};
        if (settings.fingerprint) {
          obj.fp = settings.fingerprint;
        }
        if (settings.allowInsecure) {
          obj.allowInsecure = settings.allowInsecure;
        }
      }

      genMultipleLinks(protocol, credential, externalProxies, baseParams, inbound, email, stream, flow) {
        const links = [];
        const security = stream.security || 'none';
        externalProxies.forEach(ep => {
          const newSecurity = ep.forceTls || 'same';
          const dest = ep.dest;
          const port = ep.port;
          const params = new URLSearchParams();
          baseParams.forEach((value, key) => {
            params.set(key, value);
          });
          if (newSecurity !== 'same') {
            params.set('security', newSecurity);
            if (newSecurity === 'none') {
              params.delete('alpn');
              params.delete('sni');
              params.delete('fp');
              params.delete('allowInsecure');
              params.delete('pbk');
              params.delete('sid');
              params.delete('spx');
              params.delete('pqv');
              params.delete('flow');
            } else if (newSecurity === 'tls') {
              params.delete('pbk');
              params.delete('sid');
              params.delete('spx');
              params.delete('pqv');
              if (security !== 'tls') {
                const tlsSetting = stream.tlsSettings || {};
                if (tlsSetting.serverName) {
                  params.set('sni', tlsSetting.serverName);
                }
                const settings = tlsSetting.settings || {};
                if (settings.fingerprint) {
                  params.set('fp', settings.fingerprint);
                }
              }
            }
          } else {
            params.set('security', security);
          }
          let link = `${protocol}://${credential}@${dest}:${port}`;
          const url = new URL(link);
          params.forEach((value, key) => {
            url.searchParams.set(key, value);
          });
          url.hash = this.genRemark(inbound, email, ep.remark || '');
          links.push(url.toString());
        });
        return links.join('\n');
      }

      genVmessMultipleLinks(baseObj, externalProxies, inbound, email, security) {
        const links = [];
        externalProxies.forEach(ep => {
          const newSecurity = ep.forceTls || 'same';
          const obj = {};
          for (const key in baseObj) {
            obj[key] = baseObj[key];
          }
          obj.add = ep.dest;
          obj.port = ep.port;
          obj.ps = this.genRemark(inbound, email, ep.remark || '');
          if (newSecurity !== 'same') {
            obj.tls = newSecurity;
            if (newSecurity === 'none') {
              delete obj.alpn;
              delete obj.sni;
              delete obj.fp;
              delete obj.allowInsecure;
            }
          }
          const jsonStr = JSON.stringify(obj, null, 2);
          links.push('vmess://' + btoa(jsonStr));
        });
        return links.join('\n');
      }

      genSsMultipleLinks(encPart, externalProxies, baseParams, inbound, email, security, stream) {
        const links = [];
        externalProxies.forEach(ep => {
          const newSecurity = ep.forceTls || 'same';
          const dest = ep.dest;
          const port = ep.port;
          const params = new URLSearchParams();
          baseParams.forEach((value, key) => {
            params.set(key, value);
          });
          if (newSecurity !== 'same') {
            params.set('security', newSecurity);
            if (newSecurity === 'none') {
              params.delete('alpn');
              params.delete('sni');
              params.delete('fp');
              params.delete('allowInsecure');
            }
          } else {
            params.set('security', security);
          }
          const encodedPart = btoa(encPart).replace(/=+$/, '');
          let link = `ss://${encodedPart}@${dest}:${port}`;
          const url = new URL(link);
          params.forEach((value, key) => {
            url.searchParams.set(key, value);
          });
          url.hash = this.genRemark(inbound, email, ep.remark || '');
          links.push(url.toString());
        });
        return links.join('\n');
      }

      genRemark(inbound, email, extra) {
        const separationChar = this.remarkModel[0];
        const orderChars = this.remarkModel.substring(1);
        const orders = {
          'i': inbound.remark || '',
          'e': email || '',
          'o': extra || ''
        };
        if (orders['i'] && orders['e'] && orders['i'] === orders['e']) {
          orders['e'] = '';
        }
        if (orders['i'] && orders['o'] && orders['i'] === orders['o']) {
          orders['o'] = '';
        }
        if (orders['e'] && orders['o'] && orders['e'] === orders['o']) {
          orders['o'] = '';
        }
        const remark = [];
        for (let i = 0; i < orderChars.length; i++) {
          const char = orderChars[i];
          const order = orders[char];
          if (order) {
            remark.push(order);
          }
        }
        return remark.join(separationChar);
      }

      searchHost(headers) {
        for (const key in headers) {
          if (key.toLowerCase() === 'host') {
            const value = headers[key];
            if (Array.isArray(value) && value.length > 0) {
              return value[0];
            }
            return value;
          }
        }
        return '';
      }

      randomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      }

      isNodeValid(inbound) {
        if (!inbound.enable) {
          return false;
        }
        const now = Date.now();
        return !(inbound.expiryTime > 0 && inbound.expiryTime < now);
      }

      generateAllLinks(apiResponse, address) {
        const results = [];
        if (!apiResponse.success || !apiResponse.obj) {
          console.error('无效的 API 响应');
          return results;
        }
        apiResponse.obj.forEach(inbound => {
          if (!this.isNodeValid(inbound)) {
            return;
          }
          const links = this.generateLinks(inbound, address);
          if (links.length > 0) {
            results.push({
              id: inbound.id,
              remark: inbound.remark,
              protocol: inbound.protocol,
              port: inbound.port,
              links: links
            });
          }
        });
        return results;
      }
    }

    const DEFAULT_CONFIG = {
        startPort: 30000,
        target: "www.apple.com:443",
        serverName: "www.apple.com",
        randomPortMode: false
    };

    let CONFIG = loadConfig();

    function loadConfig() {
        try {
            const savedConfig = localStorage.getItem('XUI_NODE_CONFIG');
            if (savedConfig) return { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
        } catch (e) {}
        return DEFAULT_CONFIG;
    }

    function saveConfig(newConfig) {
        CONFIG = newConfig;
        try {
            localStorage.setItem('XUI_NODE_CONFIG', JSON.stringify(CONFIG));
            toast('配置已保存!', 'success');
        } catch (e) {
            toast('配置保存失败!', 'error');
        }
    }

    const CONFIG_INPUTS = [
        { id: 'config-startPort', key: 'startPort', type: 'number', label: '起始查找端口 (startPort)' },
        { id: 'config-target', key: 'target', type: 'text', label: 'Reality 回落地址 (Target)' },
        { id: 'config-serverName', key: 'serverName', type: 'text', label: 'Reality 伪装域名 (ServerName / SNI)' },
        { id: 'config-randomPortMode', key: 'randomPortMode', type: 'checkbox', label: '启用随机端口模式 (10000-60000)' }
    ];

    const SVG_ICONS = {
        main: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        toggle: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        error: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
        ladder: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L10 6.54z"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L14 17.46z"></path></svg>`,
        settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 .33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
        shieldOff: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="4.03" y1="4.03" x2="19.97" y2="19.97"></line></svg>`,
        plus: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`,
        route: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
        list: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`,
        copy: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`
    };

    function injectStyles() {
        if (document.getElementById('xui-css')) return;
        const css = `
            #xui-float-btn{position:fixed;top:20px;right:20px;width:50px;height:50px;background:#1f2937;border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;cursor:move;box-shadow:0 4px 15px rgba(0,0,0,0.3);z-index:9998;transition:transform .2s,background .2s;user-select:none}
            #xui-float-btn:hover{background:#000;transform:scale(1.05)}
            #xui-float-btn:active{transform:scale(0.95)}
            #xui-backdrop,#xui-route-backdrop,#xui-delete-backdrop,#xui-shownodes-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);z-index:9999;display:none;justify-content:center;align-items:center;animation:fadeIn .4s ease-in-out}
            @keyframes fadeIn{from{opacity:0}to{opacity:1}}
            #xui-panel,#xui-route-panel,#xui-delete-panel,#xui-shownodes-panel{background:#fff;width:900px;max-height:90vh;overflow-y:auto;border-radius:12px;box-shadow:0 25px 50px rgba(0,0,0,0.4);animation:slideUp .4s cubic-bezier(.34,1.56,.64,1);border:1px solid #e5e7eb}
            #xui-confirm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);z-index:10001;display:none;justify-content:center;align-items:center;animation:fadeIn .4s ease-in-out}
            .xp-confirm-panel{background:#fff;width:400px;padding:20px;border-radius:12px;box-shadow:0 25px 50px rgba(0,0,0,0.4);animation:slideUp .4s cubic-bezier(.34,1.56,.64,1);border:1px solid #e5e7eb;text-align:center}
            .xp-confirm-title{font-size:18px;font-weight:700;color:#1f2937;margin-bottom:12px}
            .xp-confirm-content{font-size:14px;color:#4b5563;margin-bottom:20px}
            .xp-confirm-btns{display:flex;justify-content:center;gap:12px}
            .xp-confirm-yes{background:#ef4444;color:white;padding:10px 20px;border:none;border-radius:8px;font-size:14px;cursor:pointer;transition:all .2s}
            .xp-confirm-yes:hover{background:#dc2626}
            .xp-confirm-no{background:#6b7280;color:white;padding:10px 20px;border:none;border-radius:8px;font-size:14px;cursor:pointer;transition:all .2s}
            .xp-confirm-no:hover{background:#4b5563}
            @keyframes slideUp{from{transform:translateY(30px) scale(0.95);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
            .xp-header{background:#f9fafb;padding:20px 24px;color:#1f2937;position:relative;border-bottom:1px solid #e5e7eb}
            .xp-title{font-size:18px;font-weight:700}
            .xp-subtitle{font-size:13px;color:#6b7280;margin-top:4px}
            .xp-close{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:6px;background:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#6b7280;transition:all .2s}
            .xp-close:hover{background:#e5e7eb;color:#1f2937}
            .xp-body{padding:24px}
            .xp-protocol-item{background:white;border-radius:8px;margin-bottom:12px;border:1px solid #d1d5db;transition:border-color .2s}
            .xp-protocol-item.selected{border-color:#1f2937;background:#f9fafb}
            .xp-protocol-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;transition:background .2s}
            .xp-protocol-main{display:flex;align-items:center;flex:1;gap:12px;cursor:pointer}
            .xp-protocol-icon{width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#1f2937;border-radius:6px;background:#e5e7eb}
            .xp-protocol-name{font-weight:600;font-size:14px;color:#1f2937}
            .xp-protocol-actions{display:flex;align-items:center;gap:8px}
            .xp-toggle-btn{width:28px;height:28px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;color:#6b7280}
            .xp-toggle-btn:hover{background:#e5e7eb;color:#1f2937}
            .xp-toggle-btn.active{transform:rotate(180deg)}
            .xp-checkbox-wrapper{height:18px}
            .xp-checkbox{width:18px;height:18px;border:2px solid #6b7280;border-radius:4px;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;color:white;box-sizing:border-box}
            .xp-checkbox.checked{background:#1f2937;border-color:#1f2937}
            .xp-checkbox.checked svg{stroke:white}
            .xp-checkbox.disabled{opacity:0.4;cursor:not-allowed;border-color:#9ca3af}
            .xp-checkbox.disabled.checked{background:#6b7280;border-color:#6b7280}
            .xp-info-panel{max-height:0;overflow:hidden;transition:max-height .3s ease-in-out}
            .xp-info-panel.show{max-height:600px}
            .xp-info-content{padding:8px 16px 16px 16px;border-top:1px solid #f3f4f6}
            .xp-info-title{font-size:12px;font-weight:600;color:#6b7280;margin:12px 0 8px 0;text-transform:uppercase;letter-spacing:.5px}
            .xp-info-list{display:grid;gap:4px;font-size:13px;color:#4b5563}
            .xp-info-item{display:flex;align-items:center;gap:6px;padding:4px 0}
            .xp-info-item::before{content:"—";color:#9ca3af;font-weight:400}
            .xp-footer{padding:16px 24px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;background:#f9fafb}
            .xp-create-btn-main{background:#1f2937;color:white;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all .3s;box-shadow:0 4px 10px rgba(31,41,55,.3)}
            .xp-create-btn-main:hover{background:#000;transform:translateY(-1px);box-shadow:0 6px 15px rgba(31,41,55,.4)}
            .xp-create-btn-main:active{transform:translateY(0);background:#374151}
            .xp-create-btn-main:disabled{opacity:.7;cursor:not-allowed}
            .xp-toast{position:fixed;top:24px;right:24px;z-index:10000;padding:12px 20px;border-radius:8px;color:white;font-weight:600;font-size:13px;box-shadow:0 8px 20px rgba(0,0,0,.3);animation:slideInRight .4s cubic-bezier(.34,1.56,.64,1);display:flex;align-items:center;gap:8px}
            .xp-toast svg{width:18px;height:18px;stroke:white}
            @keyframes slideInRight{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}
            .xp-toast.success{background:#10b981}
            .xp-toast.error{background:#ef4444}
            .xp-select-all{display:flex;align-items:center;font-size:13px;color:#4b5563;cursor:pointer}
            .xp-footer-link{color:#6b7280;font-size:13px;cursor:pointer;transition:color .2s;font-weight:500;display:flex;align-items:center;gap:4px;text-decoration:none}
            .xp-footer-link:hover{color:#1f2937}
            .xp-config-group{margin-bottom:20px}
            .xp-config-label{display:block;font-size:14px;font-weight:600;color:#1f2937;margin-bottom:6px}
            .xp-config-input{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;transition:border-color .2s}
            .xp-config-input:focus{border-color:#1f2937;outline:none}
            .xp-config-checkbox-group{display:flex;align-items:center;gap:10px;font-size:14px;color:#1f2937}
            .xp-config-title-small{font-size:16px;font-weight:700;color:#1f2937;margin-bottom:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px}
            .xp-save-config-btn{background:#1f2937;color:white;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all .3s;box-shadow:0 4px 10px rgba(31,41,55,.3)}
            .xp-save-config-btn:hover{background:#000;transform:translateY(-1px);box-shadow:0 6px 15px rgba(31,41,55,.4)}
            .xp-danger-btn{color:#ef4444;font-size:13px;cursor:pointer;transition:color .2s;font-weight:500;display:flex;align-items:center;gap:4px;background:none;border:1px solid transparent;padding:4px 8px;border-radius:6px}
            .xp-danger-btn:hover{background:#fef2f2;color:#dc2626}
            .xp-action-btn{color:#3b82f6;font-size:13px;cursor:pointer;transition:color .2s;font-weight:500;display:flex;align-items:center;gap:4px;background:none;border:1px solid transparent;padding:4px 8px;border-radius:6px}
            .xp-action-btn:hover{background:#eff6ff;color:#2563eb}
            .route-item{padding:10px 12px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;position:relative}
            .route-item:last-child{border-bottom:none}
            .route-tag{background:#e5e7eb;color:#1f2937;padding:3px 9px;border-radius:6px;font-size:12px;font-family:SF Mono,Menlo,Monaco,Consolas,monospace;font-weight:600;letter-spacing:0.5px}
            .route-hint{font-size:11px;color:#9ca3af;position:absolute;right:12px;top:50%;transform:translateY(-50%)}
            .route-remark{margin-left:auto;color:#6b7280;font-size:12px}
            .node-result-item{margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;padding:16px}
            .node-info-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
            .node-name{font-weight:700;color:#1f2937}
            .node-protocol{background:#e5e7eb;color:#4b5563;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase}
            .node-link-wrapper{position:relative;margin-top:8px}
            .node-link-scroller{background:#f6f8fa;border-radius:6px;padding:12px;font-family:SF Mono,Menlo,Monaco,Consolas,monospace;font-size:12px;color:#24292f;overflow-x:auto;white-space:nowrap}
            .node-copy-btn{position:absolute;top:4px;right:4px;padding:4px;background:transparent;border:1px solid rgba(27,31,36,0.15);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;background-color:#f6f8fa;transition:all 0.2s;color:#57606a;z-index:1}
            .node-copy-btn:hover{background-color:#f3f4f6;border-color:rgba(27,31,36,0.15);color:#24292f}
            .node-copy-btn svg{width:14px;height:14px}
            .xp-stats-card{background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;border:1px solid #e5e7eb}
            .xp-stat-item{font-size:13px;color:#4b5563;margin-bottom:8px;display:flex;align-items:center;gap:4px}
            .xp-stat-item b{font-weight:700;color:#1f2937}
            .xp-stat-item.enabled b{color:#10b981}
            .xp-stat-item.disabled b{color:#ef4444}
            .xp-stat-item.expired b{color:#f59e0b}
            .xp-stats-row{display:flex;align-items:center;flex-wrap:wrap;gap:24px}
            .xp-protocols-section{margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb}
            .xp-protocol-list{display:flex;align-items:center;flex-wrap:wrap;gap:12px}
            .xp-protocol-list .xp-protocol-item{min-width:auto;border:1px solid #d1d5db;border-radius:16px;padding:2px 10px;font-size:13px;color:#4b5563;background:white;margin:0}
            .xp-protocol-list .xp-protocol-item .protocol-count{font-weight:700;color:#1f2937}
            .xp-protocol-list .protocol-name{font-weight:400;color:#374151}
            .xp-config-checkbox-group input[type="checkbox"]{width:16px;height:16px}
            .xp-config-checkbox-group label.xp-config-label{margin:0}
            #shownodes-copy-all{width:auto;display:inline-flex;align-items:center;gap:6px}
            #xui-shownodes-panel .xp-body{padding-bottom:24px}
            .xp-header-content { display: flex; justify-content: space-between; align-items: center; }
            .xp-header .xp-create-btn-main { padding: 8px 14px; font-size: 13px; }
            #route-inbounds-list{max-height:420px;overflow-y:auto;border:1px solid #eee;border-radius:8px}
            .route-inbounds-header{margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
            #delete-nodes-list{max-height:420px;overflow-y:auto;border:1px solid #eee;border-radius:8px}
            .delete-nodes-header{margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
            #delete-apply-btn{background:#ef4444;color:white;padding:10px 20px;border-radius:8px}
            #xui-delete-panel .xp-body, #xui-route-panel .xp-body {padding-bottom:0}
            .radio-group{margin-bottom:16px;display:flex;gap:16px;align-items:center}
            .route-remark-port{color:#6b7280;font-size:12px;margin-left:auto;margin-right:120px}
        `;
        const style = document.createElement('style');
        style.id = 'xui-css';
        document.head.appendChild(style);
        style.textContent = css;
    }

    function getInboundStats(inbounds) {
        const now = Date.now();
        const stats = {
            total: inbounds.length,
            enabled: 0,
            disabled: 0,
            expired: 0,
            protocols: {}
        };
        inbounds.forEach(inbound => {
            const protocol = inbound.protocol.toUpperCase();
            if (!stats.protocols[protocol]) {
                stats.protocols[protocol] = 0;
            }
            stats.protocols[protocol]++;
            if (inbound.enable) {
                stats.enabled++;
            } else {
                stats.disabled++;
            }
            if (inbound.expiryTime > 0 && inbound.expiryTime < now) {
                stats.expired++;
            }
        });
        return stats;
    }

    function toast(msg, type) {
        const t = document.createElement('div');
        t.className = `xp-toast ${type}`;
        let iconHtml = type === 'success' ? SVG_ICONS.success : SVG_ICONS.error;
        t.innerHTML = `${iconHtml}<span>${msg}</span>`;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }

    function getBasePath() {
        const pathname = window.location.pathname;
        const match = pathname.match(/(.*)\/panel\//);
        const prefix = match ? match[1] : '';
        return `${window.location.origin}${prefix}`;
    }

    async function getKeys() {
        try {
            const res = await fetch(`${getBasePath()}/panel/api/server/getNewX25519Cert`);
            const data = await res.json();
            if (data.success && data.obj) return data.obj;
            throw new Error(data.msg || '未知错误');
        } catch (e) {
            throw new Error(`Reality 密钥获取失败: ${e.message}`);
        }
    }

    async function getVlessEnc() {
        try {
            const res = await fetch(`${getBasePath()}/panel/api/server/getNewVlessEnc`);
            const data = await res.json();
            if (data.success && data.obj && data.obj.auths && data.obj.auths.length >= 2) return data.obj.auths[1];
            throw new Error(data.msg || '未知错误');
        } catch (e) {
            throw new Error(`VLESS Encryption 获取失败: ${e.message}`);
        }
    }

    async function getAvailablePort() {
        if (CONFIG.randomPortMode) {
            return Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
        }
        try {
            const res = await fetch(`${getBasePath()}/panel/api/inbounds/list`);
            const data = await res.json();
            if (!data.success) throw new Error("无法获取端口列表");
            const usedPorts = new Set(data.obj.map(i => i.port));
            let port = parseInt(CONFIG.startPort, 10);
            while (usedPorts.has(port)) {
                port++;
                if (port > 65535) throw new Error("端口已用尽 (65535)");
            }
            return port;
        } catch (e) {
            throw new Error(`端口检测失败: ${e.message}`);
        }
    }

    function randomUUID() {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.substr(0, 8)}-${hex.substr(8, 4)}-${hex.substr(12, 4)}-${hex.substr(16, 4)}-${hex.substr(20, 12)}`;
    }

    function randomShortId() {
        const bytes = new Uint8Array(8);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    function randomLowerAndNum(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const randomValues = new Uint8Array(length);
        window.crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            result += chars[randomValues[i] % chars.length];
        }
        return result;
    }

    function randomBase64(length) {
        const bytes = new Uint8Array(length);
        window.crypto.getRandomValues(bytes);
        return btoa(String.fromCharCode.apply(null, bytes));
    }

    async function getPanelSettings() {
        try {
            const res = await fetch(`${getBasePath()}/panel/setting/all`, { method: 'POST' });
            const data = await res.json();
            if (data.success) return data.obj;
            throw new Error(data.msg || '未知错误');
        } catch (e) {
            throw new Error(`获取面板设置失败: ${e.message}`);
        }
    }

    const PROTOCOL_FULL_NAMES = {
        'vision': 'VLESS_TCP_REALITY_VISION',
        'xhttp': 'VLESS_XHTTP_REALITY',
        'vless_xhttp_enc': 'VLESS_XHTTP_ENCRYPTION',
        'vless_xhttp_enc_tls': 'VLESS_XHTTP_ENCRYPTION_TLS',
        'vless_ws': 'VLESS_WS',
        'vless_ws_tls': 'VLESS_WS_TLS',
        'vmess_ws': 'VMESS_WS',
        'vmess_ws_tls': 'VMESS_WS_TLS',
        'ss_blake3_chacha20_poly1305': 'SS_TCP_2022_BLAKE3_CHACHA20_POLY1305',
        'ss_blake3_aes_256_gcm': 'SS_TCP_2022_BLAKE3_AES_256_GCM',
        'ss_blake3_aes_128_gcm': 'SS_TCP_2022_BLAKE3_AES_128_GCM'
    };

    async function createNode(type) {
        let port;
        try {
            port = await getAvailablePort();
        } catch(e) {
             toast(`${e.message}`, 'error');
             return false;
        }

        let protocol, settings, stream, sniff = {
            enabled: false,
            destOverride: ["http", "tls", "quic", "fakedns"],
            metadataOnly: false,
            routeOnly: false
        };

        const uid = randomUUID();
        const email = randomLowerAndNum(8);
        const subId = randomLowerAndNum(16);

        let fullName = PROTOCOL_FULL_NAMES[type] || type.toUpperCase();
        const tag = `${fullName}-${port}`;

        const isTls = type.endsWith('_tls');
        let panelSettings;
        if (isTls) {
            if (location.protocol !== 'https:') {
                toast('TLS节点需要HTTPS访问面板', 'error');
                return false;
            }
            try {
                panelSettings = await getPanelSettings();
                if (!panelSettings.webDomain || !panelSettings.webCertFile || !panelSettings.webKeyFile) {
                    toast('缺少TLS配置信息', 'error');
                    return false;
                }
            } catch (e) {
                toast(`${e.message}`, 'error');
                return false;
            }
        }

        if (type === 'vision' || type === 'xhttp') {
            let keys;
            try { keys = await getKeys(); } catch(e) { toast(`${e.message}`, 'error'); return false; }

            protocol = "vless";
            const shortIds = [];
            for (let i = 0; i < 8; i++) { shortIds.push(randomShortId()); }
            const spiderX = `/${shortIds[0]},${shortIds[1]}`;

            settings = JSON.stringify({
                clients: [{ id: uid, flow: type === 'vision' ? "xtls-rprx-vision" : "", email: email, subId: subId, limitIp: 0, totalGB: 0, expiryTime: 0, enable: true, tgId: "", comment: "", reset: 0 }],
                decryption: "none", encryption: "none"
            });

            stream = {
                network: type === 'xhttp' ? 'xhttp' : 'tcp', security: "reality", externalProxy: [],
                realitySettings: {
                    show: false, xver: 0, target: CONFIG.target, serverNames: [CONFIG.serverName],
                    privateKey: keys.privateKey, shortIds: shortIds, minClientVer: "", maxClientVer: "", maxTimediff: 0, mldsa65Seed: "",
                    settings: {
                        publicKey: keys.publicKey, fingerprint: "chrome", serverName: "",
                        spiderX: spiderX, mldsa65Verify: ""
                    }
                }
            };
            if (type === 'xhttp') { stream.xhttpSettings = { path: `/${randomShortId()}`, host: "" }; }
            else { stream.tcpSettings = { acceptProxyProtocol: false, header: { type: "none" } }; }

        } else if (type === 'vless_xhttp_enc' || type === 'vless_xhttp_enc_tls') {
            let auth;
            try { auth = await getVlessEnc(); } catch(e) { toast(`${e.message}`, 'error'); return false; }
            protocol = "vless";
            settings = JSON.stringify({
                clients: [{ id: uid, flow: "", email: email, subId: subId, limitIp: 0, totalGB: 0, expiryTime: 0, enable: true, tgId: "", comment: "", reset: 0 }],
                decryption: auth.decryption, encryption: auth.encryption, selectedAuth: auth.label
            });
            stream = {
                network: "xhttp", security: isTls ? "tls" : "none", externalProxy: [],
                xhttpSettings: { path: `/${randomShortId()}`, host: isTls ? panelSettings.webDomain : "" }
            };
            if (isTls) {
                stream.tlsSettings = {
                    serverName: panelSettings.webDomain,
                    minVersion: "1.2",
                    maxVersion: "1.3",
                    cipherSuites: "",
                    rejectUnknownSni: false,
                    verifyPeerCertInNames: ["dns.google", "cloudflare-dns.com"],
                    disableSystemRoot: false,
                    enableSessionResumption: false,
                    certificates: [{
                        certificateFile: panelSettings.webCertFile,
                        keyFile: panelSettings.webKeyFile,
                        oneTimeLoading: false,
                        usage: "encipherment",
                        buildChain: false
                    }],
                    alpn: ["h2", "http/1.1", "h3"],
                    echServerKeys: "",
                    echForceQuery: "none",
                    settings: {
                        allowInsecure: false,
                        fingerprint: "chrome",
                        echConfigList: ""
                    }
                };
            }
        } else if (type === 'vless_ws' || type === 'vless_ws_tls' || type === 'vmess_ws' || type === 'vmess_ws_tls') {
            protocol = type.startsWith('vless') ? 'vless' : 'vmess';
            const clients = [{ id: uid, flow: "", email: email, subId: subId, limitIp: 0, totalGB: 0, expiryTime: 0, enable: true, tgId: "", comment: "", reset: 0 }];
            settings = JSON.stringify({
                clients: clients, decryption: "none", encryption: type.startsWith('vless') ? "none" : "auto"
            });
            stream = {
                network: "ws", externalProxy: [], security: isTls ? "tls" : "none",
                wsSettings: { acceptProxyProtocol: false, path: `/${randomShortId()}`, headers: {}, host: isTls ? panelSettings.webDomain : "" }
            };
            if (isTls) {
                stream.tlsSettings = {
                    serverName: panelSettings.webDomain,
                    minVersion: "1.2",
                    maxVersion: "1.3",
                    cipherSuites: "",
                    rejectUnknownSni: false,
                    verifyPeerCertInNames: ["dns.google", "cloudflare-dns.com"],
                    disableSystemRoot: false,
                    enableSessionResumption: false,
                    certificates: [{
                        certificateFile: panelSettings.webCertFile,
                        keyFile: panelSettings.webKeyFile,
                        oneTimeLoading: false,
                        usage: "encipherment",
                        buildChain: false
                    }],
                    alpn: ["h2", "http/1.1", "h3"],
                    echServerKeys: "",
                    echForceQuery: "none",
                    settings: {
                        allowInsecure: false,
                        fingerprint: "chrome",
                        echConfigList: ""
                    }
                };
            }
        } else if (type.startsWith('ss_')) {
            protocol = "shadowsocks";
            const method = '2022-' + type.replace('ss_', '').replace(/_/g, '-');
            let keyLength;
            if (method.includes('aes-128')) keyLength = 16;
            else keyLength = 32;
            const password = randomBase64(keyLength);
            let clients = [];
            if (method.includes('aes-')) {
                const clientPassword = randomBase64(keyLength);
                clients = [{
                    password: clientPassword,
                    email: email,
                    subId: subId,
                    limitIp: 0,
                    totalGB: 0,
                    expiryTime: 0,
                    enable: true,
                    tgId: "",
                    comment: "",
                    reset: 0
                }];
            }
            settings = JSON.stringify({
                method: method,
                password: password,
                network: "tcp,udp",
                clients: clients,
                ivCheck: false
            });
            stream = {
                network: "tcp",
                security: "none",
                externalProxy: [],
                tcpSettings: {
                    acceptProxyProtocol: false,
                    header: { type: "none" }
                }
            };
            fullName = PROTOCOL_FULL_NAMES[type];
        } else {
            toast(`不支持的协议类型: ${type}`, 'error');
            return false;
        }

        const payload = {
            up: 0, down: 0, total: 0, remark: fullName, enable: true, expiryTime: 0,
            trafficReset: "never", lastTrafficResetTime: 0, listen: "", port: port,
            protocol: protocol, settings: settings,
            streamSettings: JSON.stringify(stream),
            sniffing: JSON.stringify(sniff)
        };

        try {
            const res = await fetch(`${getBasePath()}/panel/api/inbounds/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                toast(`节点创建成功! ${fullName}`, 'success');
                return true;
            } else {
                throw new Error(data.msg);
            }
        } catch (e) {
            toast(`${fullName} 创建失败: ${e.message}`, 'error');
            return false;
        }
    }

    async function disableSubscription() {
        try {
            const getRes = await fetch(`${getBasePath()}/panel/setting/all`, { method: 'POST' });
            const getData = await getRes.json();
            if (!getData.success) throw new Error("获取当前设置失败");
            const settings = getData.obj;
            if (settings.subEnable === false) {
                toast('订阅访问已处于关闭状态', 'success');
                return;
            }
            settings.subEnable = false;
            const updateRes = await fetch(`${getBasePath()}/panel/setting/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const updateData = await updateRes.json();
            if (updateData.success) {
                toast('已成功关闭订阅访问 (subEnable: false),即将重启面板', 'success');
                const restartRes = await fetch(`${getBasePath()}/panel/setting/restartPanel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const restartData = await restartRes.json();
                if (restartData.success) {
                    toast('面板重启成功', 'success');
                    setTimeout(() => location.reload(), 2500);
                }
            } else {
                throw new Error(updateData.msg || "更新失败");
            }
        } catch (e) {
            toast(`关闭订阅失败: ${e.message}`, 'error');
        }
    }

    async function addOutboundRules() {
        try {
            const getRes = await fetch(`${getBasePath()}/panel/xray/`, { method: 'POST' });
            const getData = await getRes.json();
            if (!getData.success) throw new Error("获取配置失败");

            let fullConfig;
            try {
                fullConfig = JSON.parse(getData.obj);
            } catch (parseError) {
                throw new Error("解析 Xray 配置失败");
            }
            if (!fullConfig.xraySetting.outbounds) fullConfig.xraySetting.outbounds = [];
            const rulesToAdd = [
                {
                    "protocol": "freedom",
                    "settings": { "domainStrategy": "UseIPv4v6" },
                    "tag": "UseIPv4v6"
                },
                {
                    "protocol": "freedom",
                    "settings": { "domainStrategy": "UseIPv6v4" },
                    "tag": "UseIPv6v4"
                }
            ];
            let addedCount = 0;
            rulesToAdd.forEach(rule => {
                const exists = fullConfig.xraySetting.outbounds.some(o =>
                    o.protocol === rule.protocol &&
                    o.settings &&
                    rule.settings &&
                    o.settings.domainStrategy === rule.settings.domainStrategy
                );
                if (!exists) {
                    fullConfig.xraySetting.outbounds.push(rule);
                    addedCount++;
                }
            });
            if (addedCount === 0) {
                toast('出站规则已存在，无需添加', 'success');
                return;
            }
            const formData = new URLSearchParams();
            formData.append('xraySetting', JSON.stringify(fullConfig.xraySetting));

            const updateRes = await fetch(`${getBasePath()}/panel/xray/update`, {
                method: 'POST',
                body: formData
            });
            const updateData = await updateRes.json();
            if (updateData.success) {
                toast('出站规则添加成功，正在重启 Xray...', 'success');
                const restartRes = await fetch(`${getBasePath()}/panel/api/server/restartXrayService`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const restartData = await restartRes.json();
                if (restartData.success) {
                    toast('Xray 重启成功', 'success');
                    setTimeout(() => location.reload(), 2500);
                } else {
                    toast('Xray 重启失败', 'error');
                }
            } else {
                throw new Error(updateData.msg || "配置更新失败");
            }
        } catch (e) {
            toast(`添加出站规则失败: ${e.message}`, 'error');
        }
    }

    async function checkOutboundRulesExist() {
        try {
            const res = await fetch(`${getBasePath()}/panel/xray/`, { method: 'POST' });
            const data = await res.json();
            if (!data.success) return false;

            const config = JSON.parse(data.obj);
            const outbounds = config.xraySetting?.outbounds || [];

            const hasIPv4v6 = outbounds.some(o =>
                o.protocol === "freedom" &&
                o.settings?.domainStrategy === "UseIPv4v6"
            );

            const hasIPv6v4 = outbounds.some(o =>
                o.protocol === "freedom" &&
                o.settings?.domainStrategy === "UseIPv6v4"
            );

            return hasIPv4v6 && hasIPv6v4;
        } catch (e) {
            return false;
        }
    }

    async function openRoutingConfig() {
        const hasOutbounds = await checkOutboundRulesExist();
        if (!hasOutbounds) {
            toast('缺失关键出站规则「UseIPv4v6 / UseIPv6v4」！请先点击「添加出站」按钮添加后再配置路由', 'error');
            return;
        }

        let currentRules = [];
        let inbounds = [];
        let v4Tags = new Set();
        let v6Tags = new Set();
        let ipv4v6Tag = '';
        let ipv6v4Tag = '';
        try {
            const inboundsRes = await fetch(`${getBasePath()}/panel/api/inbounds/list`);
            const inboundsData = await inboundsRes.json();
            if (!inboundsData.success) throw new Error("获取入站列表失败");
            inbounds = inboundsData.obj.map(item => ({
                tag: item.tag,
                remark: item.remark || '未知节点'
            }));

            const xrayRes = await fetch(`${getBasePath()}/panel/xray/`, { method: 'POST' });
            const xrayData = await xrayRes.json();
            if (!xrayData.success) throw new Error('获取Xray配置失败');
            const obj = JSON.parse(xrayData.obj);
            currentRules = obj.xraySetting.routing?.rules || [];
            const outbounds = obj.xraySetting.outbounds || [];
            const ipv4v6Outbound = outbounds.find(o => o.protocol === "freedom" && o.settings?.domainStrategy === "UseIPv4v6");
            const ipv6v4Outbound = outbounds.find(o => o.protocol === "freedom" && o.settings?.domainStrategy === "UseIPv6v4");
            if (!ipv4v6Outbound || !ipv6v4Outbound) {
                toast('无法找到出站规则的 tag，请检查配置', 'error');
                return;
            }
            ipv4v6Tag = ipv4v6Outbound.tag;
            ipv6v4Tag = ipv6v4Outbound.tag;

        } catch (e) {
            toast('获取配置失败: ' + e.message, 'error');
            return;
        }

        currentRules.forEach(r => {
            if (r.type === "field" && Array.isArray(r.inboundTag) && r.outboundTag === ipv4v6Tag) {
                r.inboundTag.forEach(t => v4Tags.add(t));
            }
            if (r.type === "field" && Array.isArray(r.inboundTag) && r.outboundTag === ipv6v4Tag) {
                r.inboundTag.forEach(t => v6Tags.add(t));
            }
        });

        const backdrop = document.createElement('div');
        backdrop.id = 'xui-route-backdrop';
        backdrop.innerHTML = `
            <div id="xui-route-panel">
                <div class="xp-header">
                    <div class="xp-title">一键配置路由规则</div>
                    <div class="xp-subtitle">绑定路由规则IPv4/IPv6优先</div>
                    <div class="xp-close" id="route-close">${SVG_ICONS.close}</div>
                </div>
                <div class="xp-body">
                    <div class="radio-group">
                        <label><input type="radio" name="outbound" value="${ipv4v6Tag}" checked> IPv4优先 (${ipv4v6Tag})</label>
                        <label><input type="radio" name="outbound" value="${ipv6v4Tag}"> IPv6优先 (${ipv6v4Tag})</label>
                    </div>
                    <div class="route-inbounds-header">
                        <div class="xp-select-all" id="route-select-all">
                            <div class="xp-checkbox" id="route-select-all-cb"></div>全选可用
                        </div>
                        <button class="xp-create-btn-main" id="route-apply-btn">应用并保存</button>
                    </div>
                    <div id="route-inbounds-list"></div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        backdrop.style.display = 'flex';

        const list = document.getElementById('route-inbounds-list');

        const updateItemState = () => {
            const priority = document.querySelector('input[name="outbound"]:checked').value;
            const isIPv4Priority = priority === ipv4v6Tag;
            const blockedSet = isIPv4Priority ? v6Tags : v4Tags;
            const currentSet = isIPv4Priority ? v4Tags : v6Tags;

            list.querySelectorAll('.xp-checkbox').forEach(cb => {
                const tag = cb.dataset.tag;
                const isCurrent = currentSet.has(tag);
                const isBlocked = blockedSet.has(tag);

                cb.classList.toggle('disabled', isBlocked);
                if (isBlocked) {
                    cb.classList.remove('checked');
                    cb.innerHTML = '';
                } else if (isCurrent && !cb.classList.contains('checked')) {
                    cb.classList.add('checked');
                    cb.innerHTML = SVG_ICONS.check;
                }
            });
            updateSelectAllState();
        };

        const updateSelectAllState = () => {
            const allCheckboxes = Array.from(list.querySelectorAll('.xp-checkbox'));
            const availableCheckboxes = allCheckboxes.filter(cb => !cb.classList.contains('disabled'));
            const checkedCheckboxes = availableCheckboxes.filter(cb => cb.classList.contains('checked'));
            const isAllChecked = availableCheckboxes.length > 0 && checkedCheckboxes.length === availableCheckboxes.length;
            const selectAllCb = document.getElementById('route-select-all-cb');
            selectAllCb.classList.toggle('checked', isAllChecked);
            selectAllCb.innerHTML = isAllChecked ? SVG_ICONS.check : '';
        };

        list.innerHTML = inbounds.length ? inbounds.map(item => {
            const tag = item.tag;
            const remark = item.remark;
            const inV4 = v4Tags.has(tag);
            const inV6 = v6Tags.has(tag);
            const hint = inV4 ? '已绑定IPv4优先' : inV6 ? '已绑定IPv6优先' : '';
            const isChecked = (document.querySelector('input[name="outbound"]:checked').value === ipv4v6Tag ? inV4 : inV6);
            return `
                <div class="route-item">
                    <div class="xp-checkbox ${isChecked ? 'checked' : ''}" data-tag="${tag}">${isChecked ? SVG_ICONS.check : ''}</div>
                    <span class="route-tag">${tag}</span>
                    <span class="route-remark">${remark}</span>
                    ${hint ? `<span class="route-hint">${hint}</span>` : ''}
                </div>
            `;
        }).join('') : '<div style="text-align:center;color:#999;padding:30px">暂无入站节点</div>';

        document.getElementById('route-close').onclick = () => backdrop.remove();
        backdrop.onclick = e => { if (e.target === backdrop) backdrop.remove(); };

        document.querySelectorAll('input[name="outbound"]').forEach(r => r.onchange = updateItemState);

        list.onclick = e => {
            const cb = e.target.closest('.xp-checkbox');
            if (!cb || cb.classList.contains('disabled')) return;
            cb.classList.toggle('checked');
            cb.innerHTML = cb.classList.contains('checked') ? SVG_ICONS.check : '';
            updateSelectAllState();
        };

        document.getElementById('route-select-all').onclick = () => {
            const shouldCheck = !document.getElementById('route-select-all-cb').classList.contains('checked');
            list.querySelectorAll('.xp-checkbox').forEach(cb => {
                if (!cb.classList.contains('disabled')) {
                    cb.classList.toggle('checked', shouldCheck);
                    cb.innerHTML = shouldCheck ? SVG_ICONS.check : '';
                }
            });
            updateSelectAllState();
        };

        document.getElementById('route-apply-btn').onclick = async () => {
            const priority = document.querySelector('input[name="outbound"]:checked').value;
            const selected = Array.from(list.querySelectorAll('.xp-checkbox.checked')).map(cb => cb.dataset.tag);

            try {
                const res = await fetch(`${getBasePath()}/panel/xray/`, { method: 'POST' });
                const data = await res.json();
                const obj = JSON.parse(data.obj);
                let cfg = obj.xraySetting;
                if (!cfg.routing) cfg.routing = { rules: [], domainStrategy: "AsIs" };

                cfg.routing.rules = cfg.routing.rules.filter(r => {
                    if (r.type !== "field") return true;
                    if (![ipv4v6Tag, ipv6v4Tag].includes(r.outboundTag)) return true;
                    return r.outboundTag !== priority; });

                if (selected.length > 0) {
                    cfg.routing.rules.push({
                        type: "field",
                        inboundTag: selected,
                        outboundTag: priority
                    });
                }

                const formData = new URLSearchParams();
                formData.append('xraySetting', JSON.stringify(cfg));
                const updateRes = await fetch(`${getBasePath()}/panel/xray/update`, { method: 'POST', body: formData });
                const updateData = await updateRes.json();

                if (updateData.success) {
                    toast(selected.length === 0 ? '已清除该优先级路由规则' : '路由规则保存成功，正在重启 Xray...', 'success');
                    const restartRes = await fetch(`${getBasePath()}/panel/api/server/restartXrayService`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                    const restartData = await restartRes.json();
                    if (restartData.success) {
                        toast('Xray 重启成功', 'success');
                        setTimeout(() => { backdrop.remove(); location.reload(); }, 2000);
                    }
                } else {
                    throw new Error(updateData.msg || "保存失败");
                }
            } catch (e) {
                toast('保存失败: ' + e.message, 'error');
            }
        };

        updateItemState();
    }

    async function openBatchDelete() {
        let nodes = [];
        try {
            const res = await fetch(`${getBasePath()}/panel/api/inbounds/list`);
            const data = await res.json();
            if (!data.success) throw new Error("获取节点列表失败");
            nodes = data.obj.map(item => ({
                id: item.id,
                remark: item.remark,
                port: item.port,
                protocol: item.protocol.toUpperCase()
            }));
        } catch (e) {
            toast('获取节点失败: ' + e.message, 'error');
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.id = 'xui-delete-backdrop';
        backdrop.innerHTML = `
            <div id="xui-delete-panel">
                <div class="xp-header">
                    <div class="xp-title">批量删除节点</div>
                    <div class="xp-subtitle">选择节点进行批量删除</div>
                    <div class="xp-close" id="delete-close">${SVG_ICONS.close}</div>
                </div>
                <div class="xp-body">
                    <div class="delete-nodes-header">
                        <div class="xp-select-all" id="delete-select-all">
                            <div class="xp-checkbox" id="delete-select-all-cb"></div>全选
                        </div>
                        <button class="xp-danger-btn" id="delete-apply-btn">删除选中</button>
                    </div>
                    <div id="delete-nodes-list"></div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        backdrop.style.display = 'flex';

        const list = document.getElementById('delete-nodes-list');
        list.innerHTML = nodes.length ? nodes.map(item => `
            <div class="route-item">
                <div class="xp-checkbox" data-id="${item.id}"></div>
                <span class="route-tag">${item.remark}</span>
                <span class="route-remark-port">端口: ${item.port} | 类型: ${item.protocol}</span>
            </div>
        `).join('') : '<div style="text-align:center;color:#999;padding:30px">暂无节点</div>';

        document.getElementById('delete-close').onclick = () => backdrop.remove();
        backdrop.onclick = e => { if (e.target === backdrop) backdrop.remove(); };

        list.onclick = e => {
            const cb = e.target.closest('.xp-checkbox');
            if (!cb) return;
            cb.classList.toggle('checked');
            cb.innerHTML = cb.classList.contains('checked') ? SVG_ICONS.check : '';
            updateDeleteSelectAllState();
        };

        const updateDeleteSelectAllState = () => {
            const available = Array.from(list.querySelectorAll('.xp-checkbox'));
            const checked = available.filter(cb => cb.classList.contains('checked')).length;
            const allChecked = available.length > 0 && checked === available.length;
            const cb = document.getElementById('delete-select-all-cb');
            cb.classList.toggle('checked', allChecked);
            cb.innerHTML = allChecked ? SVG_ICONS.check : '';
        };

        document.getElementById('delete-select-all').onclick = () => {
            const shouldCheck = !document.getElementById('delete-select-all-cb').classList.contains('checked');
            list.querySelectorAll('.xp-checkbox').forEach(cb => {
                cb.classList.toggle('checked', shouldCheck);
                cb.innerHTML = shouldCheck ? SVG_ICONS.check : '';
            });
            updateDeleteSelectAllState();
        };

        document.getElementById('delete-apply-btn').onclick = async () => {
            const selected = Array.from(list.querySelectorAll('.xp-checkbox.checked')).map(cb => cb.dataset.id);
            if (selected.length === 0) {
                toast('请选择至少一个节点', 'error');
                return;
            }
            const confirmBackdrop = document.createElement('div');
            confirmBackdrop.id = 'xui-confirm-backdrop';
            confirmBackdrop.innerHTML = `
                <div class="xp-confirm-panel">
                    <div class="xp-confirm-title">确认删除</div>
                    <div class="xp-confirm-content">确认删除 ${selected.length} 个选中节点?</div>
                    <div class="xp-confirm-btns">
                        <button id="confirm-yes" class="xp-confirm-yes">是</button>
                        <button id="confirm-no" class="xp-confirm-no">否</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmBackdrop);
            confirmBackdrop.style.display = 'flex';
            document.getElementById('confirm-no').onclick = () => confirmBackdrop.remove();
            document.getElementById('confirm-yes').onclick = async () => {
                confirmBackdrop.remove();
                let successCount = 0;
                for (const id of selected) {
                    try {
                        const res = await fetch(`${getBasePath()}/panel/api/inbounds/del/${id}`, { method: 'POST' });
                        const data = await res.json();
                        if (data.success) successCount++;
                    } catch (e) {
                        toast(`删除节点 ${id} 失败: ${e.message}`, 'error');
                    }
                }
                toast(`成功删除 ${successCount} 个节点`, 'success');
                if (successCount > 0) {
                    const restartRes = await fetch(`${getBasePath()}/panel/api/server/restartXrayService`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                    const restartData = await restartRes.json();
                    if (restartData.success) {
                        setTimeout(() => { backdrop.remove(); location.reload(); }, 2000);
                    }
                }
            };
        };

        updateDeleteSelectAllState();
    }

    async function openShowNodes() {
        let results = [];
        let stats= {};
        let protocolList;
        try {
            const res = await fetch(`${getBasePath()}/panel/api/inbounds/list`);
            const data = await res.json();
            const generator = new NodeGenerator({ address: location.hostname });
            results = generator.generateAllLinks(data, location.hostname);

            stats = getInboundStats(data.obj);
            protocolList = Object.entries(stats.protocols)
                .map(([protocol, count]) => `<span>${protocol}: <b>${count}</b></span>`)
                .join(' | ');

        } catch (e) {
            toast('获取节点信息失败: ' + e.message, 'error');
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.id = 'xui-shownodes-backdrop';
        backdrop.innerHTML = `
            <div id="xui-shownodes-panel">
                <div class="xp-header">
                    <div class="xp-header-content">
                        <div>
                            <div class="xp-title">节点列表</div>
                            <div class="xp-subtitle">查看所有节点链接</div>
                        </div>
                        <button class="xp-create-btn-main" id="shownodes-copy-all">${SVG_ICONS.copy} 复制全部节点</button>
                    </div>
                    <div class="xp-close" id="shownodes-close">${SVG_ICONS.close}</div>
                </div>
                <div class="xp-body">
                    <div id="shownodes-list"></div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        backdrop.style.display = 'flex';

        function formatProtocolList(stats) {
            if (!stats.protocols || Object.keys(stats.protocols).length === 0) return '';
            const itemsHtml = Object.entries(stats.protocols).map(([protocol, count]) => {
                return `
                    <div class="xp-protocol-item">
                        <span class="protocol-name">${protocol}:</span> 
                        <b class="protocol-count">${count || 0}</b>
                    </div>
                `;
            }).join('');
            return `<div class="xp-protocol-list">${itemsHtml}</div>`;
        }

        const list = document.getElementById('shownodes-list');
        list.innerHTML = ` 
        <div id="xp-node-stats" class="xp-stats-card"> 
            <div class="xp-stats-row"> 
                <div class="xp-stat-item">总节点数: <b>${stats.total}</b></div> 
                <div class="xp-stat-item enabled">已启用: <b>${stats.enabled}</b></div> 
                <div class="xp-stat-item disabled">已禁用: <b>${stats.disabled}</b></div> 
                <div class="xp-stat-item expired">已过期: <b>${stats.expired}</b></div> 
            </div> 
            <div class="xp-protocols-section">
                ${formatProtocolList(stats)}
            </div>
        </div>
        ` + (results.length ? results.map(item => {
            const linksHtml = item.links.map(link => `
                <div class="node-link-wrapper">
                    <div class="node-link-scroller">
                        <span>${link}</span>
                    </div>
                    <button class="node-copy-btn" title="Copy" data-link="${link}">${SVG_ICONS.copy}</button>
                </div>
            `).join('');
            return `
                <div class="node-result-item">
                    <div class="node-info-row">
                        <span class="node-name">${item.remark}</span>
                        <span class="node-protocol">${item.protocol}</span>
                    </div>
                    ${linksHtml}
                </div>
            `;
        }).join('') : '<div style="text-align:center;color:#999;padding:30px">暂无可用节点链接</div>');

        if (results.length === 0) {
            const copyAllBtn = document.getElementById('shownodes-copy-all');
            copyAllBtn.disabled = true;
            copyAllBtn.textContent = '无节点可复制';
        }

        const copyToClipboard = (text) => {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            toast('已复制到剪贴板', 'success');
        };

        document.getElementById('shownodes-close').onclick = () => backdrop.remove();
        backdrop.onclick = e => { if (e.target === backdrop) backdrop.remove(); };

        document.getElementById('shownodes-copy-all').onclick = () => {
            const allLinks = results.flatMap(r => r.links).join('\n');
            if (allLinks) copyToClipboard(allLinks);
            else toast('没有可复制的链接', 'error');
        };

        list.querySelectorAll('.node-copy-btn').forEach(btn => {
            btn.onclick = () => {
                const link = btn.dataset.link;
                copyToClipboard(link);
            };
        });
    }

    async function createSelectedNodes() {
        const selectedProtocols = Array.from(document.querySelectorAll('#xp-protocols-view .xp-checkbox.checked[data-protocol]')).map(cb => cb.dataset.protocol);
        if (selectedProtocols.length === 0) {
            toast('请选择至少一个协议!', 'error');
            return;
        }
        const createButton = document.getElementById('xp-create-btn-main');
        createButton.disabled = true;
        createButton.innerText = `正在创建 (${selectedProtocols.length} 个)...`;
        let successCount = 0;
        for (const protocol of selectedProtocols) {
            if (await createNode(protocol)) successCount++;
        }
        createButton.disabled = false;
        updateCreateButtonText();
        if (successCount > 0) setTimeout(() => location.reload(), 1500);
        else toast('所有选中节点创建失败或遇到问题。', 'error');
    }

    function updateCreateButtonText() {
        const count = document.querySelectorAll('#xp-protocols-view .xp-checkbox.checked[data-protocol]').length;
        document.getElementById('xp-create-btn-main').innerText = `一键创建选中节点 (${count})`;
    }

    function updateSelectAllCheckboxState() {
        const total = document.querySelectorAll('#xp-protocols-view .xp-checkbox[data-protocol]:not(.disabled)').length;
        const checked = document.querySelectorAll('#xp-protocols-view .xp-checkbox.checked[data-protocol]:not(.disabled)').length;
        const cb = document.getElementById('xp-select-all-cb');
        const allSelected = total > 0 && total === checked;
        if (cb) {
            cb.classList.toggle('checked', allSelected);
            cb.innerHTML = allSelected ? SVG_ICONS.check : '';
        }
        updateCreateButtonText();
    }

    function toggleInfo(id) {
        const panel = document.getElementById(`info-${id}`);
        const btn = document.getElementById(`toggle-${id}`);
        if (panel.classList.contains('show')) {
            panel.classList.remove('show');
            btn.classList.remove('active');
        } else {
            document.querySelectorAll('.xp-info-panel').forEach(p => p.classList.remove('show'));
            document.querySelectorAll('.xp-toggle-btn').forEach(b => b.classList.remove('active'));
            panel.classList.add('show');
            btn.classList.add('active');
        }
    }

    function toggleCheckbox(protocol) {
        const cb = document.getElementById(`checkbox-${protocol}`);
        if (cb.classList.contains('disabled')) return;
        const item = cb.closest('.xp-protocol-item');
        const isChecked = cb.classList.toggle('checked');
        item.classList.toggle('selected', isChecked);
        cb.innerHTML = isChecked ? SVG_ICONS.check : '';
        updateSelectAllCheckboxState();
    }

    function toggleAllCheckboxes(check) {
        document.querySelectorAll('#xp-protocols-view .xp-checkbox[data-protocol]:not(.disabled)').forEach(cb => {
            const item = cb.closest('.xp-protocol-item');
            if (check) {
                cb.classList.add('checked');
                cb.innerHTML = SVG_ICONS.check;
                item.classList.add('selected');
            } else {
                cb.classList.remove('checked');
                cb.innerHTML = '';
                item.classList.remove('selected');
            }
        });
        updateSelectAllCheckboxState();
    }

    function setupConfigEvents() {
        document.getElementById('xp-save-config-btn').onclick = () => {
            const newConfig = { ...CONFIG };
            CONFIG_INPUTS.forEach(def => {
                const el = document.getElementById(def.id);
                if (el) {
                    if (def.type === 'checkbox') newConfig[def.key] = el.checked;
                    else newConfig[def.key] = def.type === 'number' ? parseInt(el.value, 10) : el.value;
                }
            });
            saveConfig(newConfig);
            updateProtocolInfoView();
            showProtocolsView();
        };
    }

    function updateHeader(title, subtitle) {
        document.getElementById('xp-title').innerText = title;
        document.getElementById('xp-subtitle').innerText = subtitle;
    }

    function showProtocolsView() {
        document.getElementById('xp-protocols-view').style.display = 'block';
        document.getElementById('xp-config-view').style.display = 'none';
        updateHeader('3X-UI多功能脚本', '3X-UI一键生成节点 (VLESS/VMESS/SS) & 一键关闭订阅访问 & 一键添加出站规则 & 一键配置路由规则 & 一键配删除入站节点 & 节点链接展示');
        document.getElementById('xp-footer').innerHTML = `
            <div class="xp-select-all" id="xp-select-all-btn">
                <div class="xp-checkbox" id="xp-select-all-cb" style="margin-right: 8px;"></div>
                全选
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
                <button class="xp-danger-btn" id="xp-disable-sub-btn">${SVG_ICONS.shieldOff} 关闭订阅</button>
                <button class="xp-action-btn" id="xp-show-nodes-btn">${SVG_ICONS.list} 展示节点</button>
                <button class="xp-action-btn" id="xp-add-outbound-btn">${SVG_ICONS.plus} 添加出站</button>
                <button class="xp-action-btn" id="xp-route-config-btn">${SVG_ICONS.route} 路由规则</button>
                <button class="xp-danger-btn" id="xp-batch-delete-btn">${SVG_ICONS.close} 批量删除</button>
                <a class="xp-footer-link" id="xp-go-config-btn">${SVG_ICONS.settings} 配置</a>
                <button class="xp-create-btn-main" id="xp-create-btn-main">一键创建选中节点</button>
            </div>
        `;
        setupEventsInProtocolsView();
        updateSelectAllCheckboxState();
    }

    function showConfigView() {
        document.getElementById('config-startPort').value = CONFIG.startPort;
        document.getElementById('config-target').value = CONFIG.target;
        document.getElementById('config-serverName').value = CONFIG.serverName;
        document.getElementById('config-randomPortMode').checked = CONFIG.randomPortMode;

        document.getElementById('xp-protocols-view').style.display = 'none';
        document.getElementById('xp-config-view').style.display = 'block';
        updateHeader('全局配置', '修改配置后将保存到浏览器。');
        document.getElementById('xp-footer').innerHTML = `
            <a class="xp-footer-link" id="xp-return-protocols-btn">← 返回</a>
            <div></div>
            <button class="xp-save-config-btn" id="xp-save-config-btn">保存配置</button>
        `;
        setupConfigEvents();
    }

    function setupEventsInProtocolsView() {
        document.getElementById('xp-create-btn-main').onclick = createSelectedNodes;
        document.getElementById('xp-disable-sub-btn').onclick = disableSubscription;
        document.getElementById('xp-show-nodes-btn').onclick = openShowNodes;
        document.getElementById('xp-add-outbound-btn').onclick = addOutboundRules;
        document.getElementById('xp-route-config-btn').onclick = openRoutingConfig;
        document.getElementById('xp-batch-delete-btn').onclick = openBatchDelete;

        document.querySelectorAll('#xp-protocols-view .xp-toggle-btn').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); toggleInfo(btn.id.replace('toggle-', '')); };
        });
        document.querySelectorAll('#xp-protocols-view .xp-protocol-main').forEach(main => {
            main.onclick = () => toggleCheckbox(main.closest('.xp-protocol-item').dataset.protocol);
        });
        document.querySelectorAll('#xp-protocols-view .xp-protocol-item .xp-checkbox[data-protocol]').forEach(checkbox => {
            checkbox.onclick = (e) => { e.stopPropagation(); toggleCheckbox(checkbox.dataset.protocol); };
        });
        document.getElementById('xp-select-all-btn').onclick = () => {
            const isAllSelected = document.querySelectorAll('#xp-protocols-view .xp-protocol-item .xp-checkbox[data-protocol]:not(.checked):not(.disabled)').length === 0;
            toggleAllCheckboxes(!isAllSelected);
        };
        document.getElementById('xp-go-config-btn').onclick = showConfigView;
    }

    function setupGlobalEvents() {
        const bd = document.getElementById('xui-backdrop');
        const closeModal = () => { bd.style.display = 'none'; };
        document.getElementById('xp-close-btn').addEventListener('click', closeModal);
        bd.addEventListener('click', (e) => { if(e.target === bd) closeModal(); });
        document.getElementById('xp-footer').addEventListener('click', (e) => {
            const returnBtn = e.target.closest('#xp-return-protocols-btn');
            if (returnBtn) {
                e.preventDefault();
                showProtocolsView();
            }
        });
    }

    function renderCheckbox(protocol, isChecked = true, isDisabled = false) {
        return `<div class="xp-checkbox-wrapper"><div class="xp-checkbox ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}" id="checkbox-${protocol}" data-protocol="${protocol}">${isChecked ? SVG_ICONS.check : ''}</div></div>`;
    }

    async function renderProtocolsView() {
        const isHttps = location.protocol === 'https:';
        let canUseTls = false;
        if (isHttps) {
            try {
                const panelSettings = await getPanelSettings();
                canUseTls = !!panelSettings.webDomain && !!panelSettings.webCertFile && !!panelSettings.webKeyFile;
            } catch (e) {}
        }
        const tlsDisabled = !canUseTls;

        return `
            <div id="xp-protocols-view">
                <div class="xp-protocol-item selected" data-protocol="vision">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">VLESS TCP REALITY VISION</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('vision')}<button class="xp-toggle-btn" id="toggle-vision">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-vision"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">Flow: xtls-rprx-vision</div><div class="xp-info-item">Target: <span id="info-vision-target">${CONFIG.target}</span></div><div class="xp-info-item">SNI: <span id="info-vision-sni">${CONFIG.serverName}</span></div></div></div></div>
                </div>
                <div class="xp-protocol-item selected" data-protocol="xhttp">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">VLESS XHTTP REALITY</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('xhttp')}<button class="xp-toggle-btn" id="toggle-xhttp">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-xhttp"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">传输: XHTTP</div><div class="xp-info-item">Target: <span id="info-xhttp-target">${CONFIG.target}</span></div><div class="xp-info-item">SNI: <span id="info-xhttp-sni">${CONFIG.serverName}</span></div></div></div></div>
                </div>
                <div class="xp-protocol-item selected" data-protocol="vless_xhttp_enc">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">VLESS XHTTP Encryption (Post-Quantum) (非 TLS)</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('vless_xhttp_enc')}<button class="xp-toggle-btn" id="toggle-vless_xhttp_enc">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-vless_xhttp_enc"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">Auth: ML-KEM-768</div><div class="xp-info-item">安全: none</div></div></div></div>
                </div>
                <div class="xp-protocol-item selected" data-protocol="vless_xhttp_enc_tls">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">VLESS XHTTP Encryption (Post-Quantum) (TLS)</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('vless_xhttp_enc_tls', !tlsDisabled, tlsDisabled)}<button class="xp-toggle-btn" id="toggle-vless_xhttp_enc_tls">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-vless_xhttp_enc_tls"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">Auth: ML-KEM-768</div><div class="xp-info-item">安全: tls</div></div></div></div>
                </div>
                <div class="xp-protocol-item selected" data-protocol="vless_ws">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">VLESS WS (非 TLS)</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('vless_ws')}<button class="xp-toggle-btn" id="toggle-vless_ws">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-vless_ws"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">传输: WS</div><div class="xp-info-item">安全: none</div></div></div></div>
                </div>
                <div class="xp-protocol-item selected" data-protocol="vless_ws_tls">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">VLESS WS (TLS)</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('vless_ws_tls', !tlsDisabled, tlsDisabled)}<button class="xp-toggle-btn" id="toggle-vless_ws_tls">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-vless_ws_tls"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">传输: WS</div><div class="xp-info-item">安全: tls</div></div></div></div>
                </div>
                <div class="xp-protocol-item selected" data-protocol="vmess_ws">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">VMESS WS (非 TLS)</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('vmess_ws')}<button class="xp-toggle-btn" id="toggle-vmess_ws">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-vmess_ws"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">传输: WS</div><div class="xp-info-item">安全: auto</div></div></div></div>
                </div>
                <div class="xp-protocol-item selected" data-protocol="vmess_ws_tls">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">VMESS WS (TLS)</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('vmess_ws_tls', !tlsDisabled, tlsDisabled)}<button class="xp-toggle-btn" id="toggle-vmess_ws_tls">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-vmess_ws_tls"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">传输: WS</div><div class="xp-info-item">安全: tls</div></div></div></div>
                </div>
                <div class="xp-protocol-item selected" data-protocol="ss_blake3_chacha20_poly1305">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">SHADOWSOCKS TCP (2022-BLAKE3-CHACHA20-POLY1305)</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('ss_blake3_chacha20_poly1305', true)}<button class="xp-toggle-btn" id="toggle-ss_blake3_chacha20_poly1305">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-ss_blake3_chacha20_poly1305"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">网络: tcp,udp</div><div class="xp-info-item">加密: 2022-blake3-chacha20-poly1305</div></div></div></div>
                </div>
                <div class="xp-protocol-item selected" data-protocol="ss_blake3_aes_256_gcm">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">SHADOWSOCKS TCP (2022-BLAKE3-AES-256-GCM)</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('ss_blake3_aes_256_gcm', true)}<button class="xp-toggle-btn" id="toggle-ss_blake3_aes_256_gcm">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-ss_blake3_aes_256_gcm"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">网络: tcp,udp</div><div class="xp-info-item">加密: 2022-blake3-aes-256-gcm</div></div></div></div>
                </div>
                <div class="xp-protocol-item selected" data-protocol="ss_blake3_aes_128_gcm">
                    <div class="xp-protocol-header">
                        <div class="xp-protocol-main"><div class="xp-protocol-icon">${SVG_ICONS.ladder}</div><div class="xp-protocol-name">SHADOWSOCKS TCP (2022-BLAKE3-AES-128-GCM)</div></div>
                        <div class="xp-protocol-actions">${renderCheckbox('ss_blake3_aes_128_gcm', true)}<button class="xp-toggle-btn" id="toggle-ss_blake3_aes_128_gcm">${SVG_ICONS.toggle}</button></div>
                    </div>
                    <div class="xp-info-panel" id="info-ss_blake3_aes_128_gcm"><div class="xp-info-content"><div class="xp-info-title">配置详情</div><div class="xp-info-list"><div class="xp-info-item">网络: tcp,udp</div><div class="xp-info-item">加密: 2022-blake3-aes-128-gcm</div></div></div></div>
                </div>
            </div>
        `;
    }

    function renderConfigView() {
        return `
            <div id="xp-config-view" style="display: none;">
                <div class="xp-config-title-small">全局设置</div>
                <div class="xp-config-group"><label for="config-startPort" class="xp-config-label">起始查找端口</label><input type="number" id="config-startPort" class="xp-config-input" min="1" max="65535" value="${CONFIG.startPort}"></div>
                <div class="xp-config-group"><label for="config-target" class="xp-config-label">Reality Target</label><input type="text" id="config-target" class="xp-config-input" value="${CONFIG.target}"></div>
                <div class="xp-config-group"><label for="config-serverName" class="xp-config-label">Reality SNI</label><input type="text" id="config-serverName" class="xp-config-input" value="${CONFIG.serverName}"></div>
                <div class="xp-config-group"><div class="xp-config-checkbox-group"><input type="checkbox" id="config-randomPortMode" ${CONFIG.randomPortMode ? 'checked' : ''}><label for="config-randomPortMode" class="xp-config-label">启用随机端口模式 (10000-60000)</label></div></div>
            </div>
        `;
    }

    function updateProtocolInfoView() {
        CONFIG = loadConfig();
        document.getElementById('info-vision-target').innerText = CONFIG.target;
        document.getElementById('info-vision-sni').innerText = CONFIG.serverName;
        document.getElementById('info-xhttp-target').innerText = CONFIG.target;
        document.getElementById('info-xhttp-sni').innerText = CONFIG.serverName;
    }

    async function openUI() {
        let bd = document.getElementById('xui-backdrop');
        if (!bd) {
            injectStyles();
            bd = document.createElement('div');
            bd.id = 'xui-backdrop';
            bd.innerHTML = `
                <div id="xui-panel">
                    <div class="xp-header">
                        <div class="xp-title" id="xp-title"></div><div class="xp-subtitle" id="xp-subtitle"></div>
                        <div class="xp-close" id="xp-close-btn">${SVG_ICONS.close}</div>
                    </div>
                    <div class="xp-body">${await renderProtocolsView()}${renderConfigView()}</div>
                    <div class="xp-footer" id="xp-footer"></div>
                </div>
            `;
            document.body.appendChild(bd);
            setupGlobalEvents();
        }
        updateProtocolInfoView();
        showProtocolsView();
        bd.style.display = 'flex';
    }

    function createFloatingBubble() {
        if (document.getElementById('xui-float-btn')) return;
        const btn = document.createElement('div');
        btn.id = 'xui-float-btn';
        btn.innerHTML = SVG_ICONS.main;
        document.body.appendChild(btn);

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let hasMoved = false;

        const onMouseDown = (e) => {
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            const rect = btn.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            btn.style.right = 'auto';
            btn.style.left = `${initialLeft}px`;
            btn.style.top = `${initialTop}px`;
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
            btn.style.left = `${initialLeft + dx}px`;
            btn.style.top = `${initialTop + dy}px`;
        };

        const onMouseUp = () => {
            isDragging = false;
        };

        const onClick = (e) => {
            if (!hasMoved) openUI();
        };

        btn.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        btn.addEventListener('click', onClick);
    }

    function init() {
        injectStyles();
        createFloatingBubble();
    }

    init();
})();