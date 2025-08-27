import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import './assets/base.css';

// Importando o PrimeVue e seus componentes/estilos
import PrimeVue from 'primevue/config';
import 'primeicons/primeicons.css';
import 'primevue/resources/themes/aura-light-blue/theme.css';
import 'primevue/resources/primevue.min.css'; // CSS Core
//import 'primeflex/primeflex.css';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import BadgeDirective from 'primevue/badgedirective';
import ConfirmDialog from 'primevue/confirmdialog';
import Toast from 'primevue/toast';
import MultiSelect from 'primevue/multiselect';
import ToggleButton from 'primevue/togglebutton';
import InputNumber from 'primevue/inputnumber';

// Importando componentes para registro global
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Card from 'primevue/card';
import FloatLabel from 'primevue/floatlabel';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Timeline from 'primevue/timeline';
import ProgressSpinner from 'primevue/progressspinner';
import Dialog from 'primevue/dialog';
import InputMask from 'primevue/inputmask';
import Calendar from 'primevue/calendar';
import FileUpload from 'primevue/fileupload';
import TieredMenu from 'primevue/tieredmenu';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import Password from 'primevue/password';
import Tooltip from 'primevue/tooltip';
import AutoComplete from 'primevue/autocomplete';
import Sidebar from 'primevue/sidebar';
import Menu from 'primevue/menu';

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, { 
    toast: {
        life: 3000,
    },
    ripple: true, 
});
app.use(ConfirmationService);
app.use(ToastService);

app.directive('badge', BadgeDirective);

// Registrando componentes globalmente
app.component('Button', Button);
app.component('InputText', InputText);
app.component('Textarea', Textarea);
app.component('Dropdown', Dropdown);
app.component('Card', Card);
app.component('FloatLabel', FloatLabel);
app.component('DataTable', DataTable);
app.component('Column', Column);
app.component('Tag', Tag);
app.component('Timeline', Timeline);
app.component('ProgressSpinner', ProgressSpinner);
app.component('Dialog', Dialog);
app.component('InputMask', InputMask);
app.component('ConfirmDialog', ConfirmDialog);
app.component('Toast', Toast); 
app.component('Calendar', Calendar);
app.component('FileUpload', FileUpload);
app.component('MultiSelect', MultiSelect);
app.component('TieredMenu', TieredMenu);
app.component('ToggleButton', ToggleButton);
app.component('Toast', Toast);
app.component('IconField', IconField);
app.component('InputIcon', InputIcon);
app.component('Password', Password);
app.directive('tooltip', Tooltip);
app.component('InputNumber', InputNumber);
app.component('AutoComplete', AutoComplete);
app.component('Sidebar', Sidebar);
app.component('Menu', Menu);

app.mount('#app')
