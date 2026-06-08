import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import Inbox from '../pages/Inbox';
import Invoices from '../pages/Invoices';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe('Dashboard', () => {
  it('renders stats grid', () => {
    render(<Dashboard />, { wrapper: Wrapper });
    expect(screen.getByText(/Loading/i)).toBeTruthy();
  });
});

describe('Inbox', () => {
  it('renders filter tabs', () => {
    render(<Inbox />, { wrapper: Wrapper });
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Urgent')).toBeTruthy();
    expect(screen.getByText('Normal')).toBeTruthy();
  });
});

describe('Invoices', () => {
  it('renders new button', () => {
    render(<Invoices />, { wrapper: Wrapper });
    expect(screen.getByText('+ New')).toBeTruthy();
  });
});
