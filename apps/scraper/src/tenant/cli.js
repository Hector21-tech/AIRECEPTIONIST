#!/usr/bin/env node

import { TenantManager } from './tenant-manager.js';
import { ApiKeyManager } from './api-key-manager.js';

/**
 * CLI for Tenant Management
 *
 * Usage:
 *   node src/tenant/cli.js tenant create <name> <email> [options]
 *   node src/tenant/cli.js tenant list
 *   node src/tenant/cli.js tenant show <tenant-id>
 *   node src/tenant/cli.js tenant delete <tenant-id>
 *   node src/tenant/cli.js apikey create <tenant-id> [name]
 *   node src/tenant/cli.js apikey list <tenant-id>
 *   node src/tenant/cli.js apikey deactivate <api-key>
 *   node src/tenant/cli.js restaurant link <tenant-id> <restaurant-slug>
 *   node src/tenant/cli.js restaurant unlink <tenant-id> <restaurant-slug>
 *   node src/tenant/cli.js restaurant list <tenant-id>
 */

const tenantManager = new TenantManager();
const apiKeyManager = new ApiKeyManager();

const commands = {
  tenant: {
    create: (args) => {
      const [name, email, ...opts] = args;

      if (!name || !email) {
        console.error('❌ Usage: tenant create <name> <email> [--company=X] [--plan=X] [--webhook=X]');
        process.exit(1);
      }

      const options = parseOptions(opts);

      const tenant = tenantManager.createTenant({
        name,
        email,
        company: options.company,
        plan: options.plan || 'free',
        webhook_url: options.webhook
      });

      console.log('✅ Tenant created successfully:');
      console.log(JSON.stringify(tenant, null, 2));

      // Auto-create API key
      const apiKey = apiKeyManager.createApiKey(tenant.id, 'Default API Key');
      console.log('\n🔑 API Key created:');
      console.log(`   ${apiKey.key}`);
      console.log('\n⚠️  Save this key securely - it cannot be retrieved later!');
    },

    list: () => {
      const tenants = tenantManager.listTenants();

      if (tenants.length === 0) {
        console.log('No tenants found.');
        return;
      }

      console.log('\n📋 Tenants:\n');
      console.table(tenants.map(t => ({
        ID: t.id,
        Name: t.name,
        Email: t.email,
        Plan: t.plan,
        Active: t.active ? '✅' : '❌',
        Created: new Date(t.created_at).toLocaleDateString('sv-SE')
      })));
    },

    show: (args) => {
      const [tenantId] = args;

      if (!tenantId) {
        console.error('❌ Usage: tenant show <tenant-id>');
        process.exit(1);
      }

      const tenant = tenantManager.getTenant(tenantId);
      const stats = tenantManager.getTenantStats(tenantId);
      const apiKeys = apiKeyManager.listTenantApiKeys(tenantId);
      const restaurants = tenantManager.getTenantRestaurants(tenantId);

      console.log('\n📊 Tenant Details:\n');
      console.log(JSON.stringify(tenant, null, 2));

      console.log('\n📈 Statistics:\n');
      console.log(JSON.stringify(stats, null, 2));

      console.log('\n🔑 API Keys:\n');
      console.table(apiKeys.map(k => ({
        Key: k.key.substring(0, 20) + '...',
        Name: k.name || 'N/A',
        Active: k.active ? '✅' : '❌',
        LastUsed: k.last_used_at ? new Date(k.last_used_at).toLocaleString('sv-SE') : 'Never',
        Created: new Date(k.created_at).toLocaleDateString('sv-SE')
      })));

      console.log('\n🍽️  Restaurants:\n');
      if (restaurants.length === 0) {
        console.log('No restaurants linked.');
      } else {
        console.table(restaurants.map(r => ({
          Slug: r.restaurant_slug,
          LinkedAt: new Date(r.created_at).toLocaleDateString('sv-SE')
        })));
      }
    },

    update: (args) => {
      const [tenantId, ...opts] = args;

      if (!tenantId || opts.length === 0) {
        console.error('❌ Usage: tenant update <tenant-id> [--name=X] [--email=X] [--plan=X] [--webhook=X] [--active=true/false]');
        process.exit(1);
      }

      const options = parseOptions(opts);
      const updates = {};

      if (options.name) updates.name = options.name;
      if (options.email) updates.email = options.email;
      if (options.plan) updates.plan = options.plan;
      if (options.webhook) updates.webhook_url = options.webhook;
      if (options.active !== undefined) updates.active = options.active === 'true' ? 1 : 0;

      const tenant = tenantManager.updateTenant(tenantId, updates);
      console.log('✅ Tenant updated successfully:');
      console.log(JSON.stringify(tenant, null, 2));
    },

    delete: (args) => {
      const [tenantId] = args;

      if (!tenantId) {
        console.error('❌ Usage: tenant delete <tenant-id> [--hard]');
        process.exit(1);
      }

      const options = parseOptions(args.slice(1));
      const result = tenantManager.deleteTenant(tenantId, options.hard === 'true');

      if (result.hard) {
        console.log('✅ Tenant permanently deleted');
      } else {
        console.log('✅ Tenant deactivated (soft delete)');
      }
    }
  },

  apikey: {
    create: (args) => {
      const [tenantId, name] = args;

      if (!tenantId) {
        console.error('❌ Usage: apikey create <tenant-id> [name]');
        process.exit(1);
      }

      const apiKey = apiKeyManager.createApiKey(tenantId, name);
      console.log('✅ API Key created successfully:');
      console.log(`\n🔑 ${apiKey.key}`);
      console.log('\n⚠️  Save this key securely - it cannot be retrieved later!');
    },

    list: (args) => {
      const [tenantId] = args;

      if (!tenantId) {
        console.error('❌ Usage: apikey list <tenant-id>');
        process.exit(1);
      }

      const apiKeys = apiKeyManager.listTenantApiKeys(tenantId, true);

      if (apiKeys.length === 0) {
        console.log('No API keys found.');
        return;
      }

      console.log('\n🔑 API Keys:\n');
      console.table(apiKeys.map(k => ({
        Key: k.key,
        Name: k.name || 'N/A',
        Active: k.active ? '✅' : '❌',
        LastUsed: k.last_used_at ? new Date(k.last_used_at).toLocaleString('sv-SE') : 'Never',
        Created: new Date(k.created_at).toLocaleDateString('sv-SE')
      })));
    },

    validate: (args) => {
      const [key] = args;

      if (!key) {
        console.error('❌ Usage: apikey validate <api-key>');
        process.exit(1);
      }

      const result = apiKeyManager.validateApiKey(key);

      if (result.valid) {
        console.log('✅ API Key is valid:');
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('❌ API Key is invalid:');
        console.log(`   ${result.error}`);
        process.exit(1);
      }
    },

    deactivate: (args) => {
      const [key] = args;

      if (!key) {
        console.error('❌ Usage: apikey deactivate <api-key>');
        process.exit(1);
      }

      apiKeyManager.deactivateApiKey(key);
      console.log('✅ API Key deactivated');
    },

    reactivate: (args) => {
      const [key] = args;

      if (!key) {
        console.error('❌ Usage: apikey reactivate <api-key>');
        process.exit(1);
      }

      apiKeyManager.reactivateApiKey(key);
      console.log('✅ API Key reactivated');
    },

    rotate: (args) => {
      const [oldKey, name] = args;

      if (!oldKey) {
        console.error('❌ Usage: apikey rotate <old-api-key> [name]');
        process.exit(1);
      }

      const result = apiKeyManager.rotateApiKey(oldKey, name);
      console.log('✅ API Key rotated successfully:');
      console.log(`\n🔑 New Key: ${result.new_key}`);
      console.log(`   Old Key: ${result.old_key} (deactivated)`);
      console.log('\n⚠️  Save the new key securely!');
    },

    delete: (args) => {
      const [key] = args;

      if (!key) {
        console.error('❌ Usage: apikey delete <api-key>');
        process.exit(1);
      }

      apiKeyManager.deleteApiKey(key);
      console.log('✅ API Key permanently deleted');
    }
  },

  restaurant: {
    link: (args) => {
      const [tenantId, restaurantSlug] = args;

      if (!tenantId || !restaurantSlug) {
        console.error('❌ Usage: restaurant link <tenant-id> <restaurant-slug>');
        process.exit(1);
      }

      const result = tenantManager.linkRestaurant(tenantId, restaurantSlug);
      console.log('✅ Restaurant linked to tenant:');
      console.log(JSON.stringify(result, null, 2));
    },

    unlink: (args) => {
      const [tenantId, restaurantSlug] = args;

      if (!tenantId || !restaurantSlug) {
        console.error('❌ Usage: restaurant unlink <tenant-id> <restaurant-slug>');
        process.exit(1);
      }

      tenantManager.unlinkRestaurant(tenantId, restaurantSlug);
      console.log('✅ Restaurant unlinked from tenant');
    },

    list: (args) => {
      const [tenantId] = args;

      if (!tenantId) {
        console.error('❌ Usage: restaurant list <tenant-id>');
        process.exit(1);
      }

      const restaurants = tenantManager.getTenantRestaurants(tenantId);

      if (restaurants.length === 0) {
        console.log('No restaurants linked to this tenant.');
        return;
      }

      console.log('\n🍽️  Tenant Restaurants:\n');
      console.table(restaurants.map(r => ({
        Slug: r.restaurant_slug,
        LinkedAt: new Date(r.created_at).toLocaleDateString('sv-SE')
      })));
    }
  }
};

// Parse command line options (--key=value format)
function parseOptions(args) {
  const options = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      options[key] = value || true;
    }
  }

  return options;
}

// Main CLI handler
async function main() {
  const [,, category, command, ...args] = process.argv;

  if (!category || !command) {
    console.log(`
🔧 Tenant Management CLI

Usage:
  node src/tenant/cli.js <category> <command> [args]

Categories and Commands:

  tenant
    create <name> <email> [--company=X] [--plan=free|pro|enterprise] [--webhook=X]
    list
    show <tenant-id>
    update <tenant-id> [--name=X] [--email=X] [--plan=X] [--webhook=X] [--active=true|false]
    delete <tenant-id> [--hard=true]

  apikey
    create <tenant-id> [name]
    list <tenant-id>
    validate <api-key>
    deactivate <api-key>
    reactivate <api-key>
    rotate <old-api-key> [name]
    delete <api-key>

  restaurant
    link <tenant-id> <restaurant-slug>
    unlink <tenant-id> <restaurant-slug>
    list <tenant-id>

Examples:
  node src/tenant/cli.js tenant create "Acme Inc" "info@acme.com" --plan=pro
  node src/tenant/cli.js apikey create tenant_abc123 "Production Key"
  node src/tenant/cli.js restaurant link tenant_abc123 torstens-angelholm
    `);
    process.exit(0);
  }

  if (!commands[category]) {
    console.error(`❌ Unknown category: ${category}`);
    process.exit(1);
  }

  if (!commands[category][command]) {
    console.error(`❌ Unknown command: ${category} ${command}`);
    process.exit(1);
  }

  try {
    commands[category][command](args);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
