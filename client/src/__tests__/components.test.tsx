import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import Invoices from '../pages/Invoices';
import Projects from '../pages/Projects';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe('Dashboard', () => {
  it('renders stats grid', () => {
    render(<Dashboard />, { wrapper: Wrapper });
    expect(screen.getByText(/Loading/i)).toBeTruthy();
  });
});

describe('Projects', () => {
  it('renders without crashing', () => {
    render(<Projects />, { wrapper: Wrapper });
    expect(screen.getByText('项目')).toBeTruthy();
  });
});

describe('Invoices', () => {
  it('renders new button', () => {
    render(<Invoices />, { wrapper: Wrapper });
    expect(screen.getByText('+ New')).toBeTruthy();
  });
});
