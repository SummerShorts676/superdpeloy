declare module 'echarts-for-react';
declare module 'echarts';
// Minimal declarations for echarts and echarts-for-react used in this project.
// Provides a loose default export so React components can import and use it.
declare module 'echarts' {
	const echarts: any;
	export default echarts;
}

declare module 'echarts-for-react' {
	import * as React from 'react';
	const ReactECharts: React.ComponentType<any>;
	export default ReactECharts;
}
