import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
//import router from './router';

// Em desenvolvimento (localhost) usa o backend local; em produção usa a URL do servidor
// Aceita VITE_API_BASE_URL ou VITE_API_URL no .env (ex.: .env.local com VITE_API_URL=http://localhost:8000)
const envApiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
const baseURL = import.meta.env.DEV
  ? (envApiUrl || 'http://localhost:8000')
  : (envApiUrl || 'https://gabinete.mogidascruzes.sp.gov.br');

const apiClient = axios.create({
  baseURL,
});

// Interceptor para adicionar o token de acesso em cada requisição
apiClient.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore();
    const token = authStore.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para lidar com a expiração do token
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const authStore = useAuthStore();

    // Se o erro for 401 e ainda não tentamos renovar o token
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        console.log('Token de acesso expirado. Tentando renovar...');
        await authStore.refreshTokenAction();
        // Atualiza o header da requisição original com o novo token
        originalRequest.headers['Authorization'] = `Bearer ${authStore.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {

        // --- AQUI ESTÁ A NOVA LÓGICA ---
        console.log('Token de renovação inválido. Deslogando...');

        // Limpa os dados de autenticação do Pinia e do LocalStorage
        authStore.logout();

        // Redireciona para a página de login
        //router.push('/login');

        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;