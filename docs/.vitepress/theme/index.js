// .vitepress/theme/index.js
import DefaultTheme from 'vitepress/theme'
import "./colors.css"
import FeatureStatusTable from './components/FeatureStatusTable.vue'
import ModulesCoverageTable from './components/ModulesCoverageTable.vue'

export default {
	...DefaultTheme,
	enhanceApp({ app }) {
		app.component('FeatureStatusTable', FeatureStatusTable)
		app.component('ModulesCoverageTable', ModulesCoverageTable)
	},
}