export default {
  title: 'RecursiveManager',
  description: 'Hierarchical AI Agent System for Recursive Delegation',
  base: '/',
  ignoreDeadLinks: true, // Temporary: many pages not yet created

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'API Reference', link: '/api/overview' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'Contributing', link: '/contributing/getting-started' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Core Concepts', link: '/guide/core-concepts' }
          ]
        },
        {
          text: 'Usage',
          items: [
            { text: 'Creating Agents', link: '/guide/creating-agents' },
            { text: 'Task Management', link: '/guide/task-management' },
            { text: 'Scheduling', link: '/guide/scheduling' },
            { text: 'Messaging', link: '/guide/messaging' }
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Multi-Perspective Analysis', link: '/guide/multi-perspective' },
            { text: 'Framework Adapters', link: '/guide/framework-adapters' },
            { text: 'Best Practices', link: '/guide/best-practices' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' }
          ]
        }
      ],

      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/overview' },
            { text: 'CLI Commands', link: '/api/cli-commands' },
            { text: 'Core API', link: '/api/core' },
            { text: 'File Schemas', link: '/api/schemas' },
            { text: 'Adapters', link: '/api/adapters' }
          ]
        }
      ],

      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/overview' },
            { text: 'System Design', link: '/architecture/system-design' },
            { text: 'File Structure', link: '/architecture/file-structure' },
            { text: 'Execution Model', link: '/architecture/execution-model' },
            { text: 'Edge Cases', link: '/architecture/edge-cases' }
          ]
        },
        {
          text: 'Multi-Perspective Analysis',
          items: [
            { text: 'Simplicity & DX', link: '/architecture/perspectives/simplicity' },
            { text: 'Architecture & Scalability', link: '/architecture/perspectives/architecture' },
            { text: 'Security & Trust', link: '/architecture/perspectives/security' }
          ]
        }
      ],

      '/contributing/': [
        {
          text: 'Contributing',
          items: [
            { text: 'Getting Started', link: '/contributing/getting-started' },
            { text: 'Development Setup', link: '/contributing/development-setup' },
            { text: 'Implementation Phases', link: '/contributing/implementation-phases' },
            { text: 'Testing Guide', link: '/contributing/testing' },
            { text: 'Code Style', link: '/contributing/code-style' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/aaron777collins/RecursiveManager' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present RecursiveManager Contributors'
    },

    search: {
      provider: 'local'
    }
  },

  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  }
};
