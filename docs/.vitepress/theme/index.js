import { createInertiaUiTheme } from '@inertiaui/docs-theme'
import { useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import Layout from './Layout.vue'

import './examples.css'
import '@inertiaui/docs-theme/base.css'

export default createInertiaUiTheme(DefaultTheme, {
    codeGroupStorageKey: 'inertiauiNotificationsCodeGroupTab',
    Layout,
    useRoute,
})
