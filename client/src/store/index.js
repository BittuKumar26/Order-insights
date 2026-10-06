import { configureStore } from '@reduxjs/toolkit';
import filters from './filtersSlice';
import dashboard from './dashboardSlice';
import orders from './ordersSlice';

export const store = configureStore({ reducer: { filters, dashboard, orders } });
