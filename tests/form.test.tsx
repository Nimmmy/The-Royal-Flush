// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddRestroomSheet } from '../src/components/AddRestroomSheet';
import { RestroomDetailSheet } from '../src/components/RestroomDetailSheet';
import { addRestroom, copyText, geocode } from '../src/lib/api';
import type { Restroom } from '../src/types';
vi.mock('../src/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/lib/api')>();
  return { ...actual, addRestroom: vi.fn(), copyText: vi.fn(), geocode: vi.fn() };
});
// Leaflet needs browser layout APIs. Its interactions are reserved for live browser QA.
vi.mock('../src/components/MapView', () => ({ PinPreview: () => <div data-testid="pin-preview">Adjustable map preview</div> }));
const record: Restroom = { id: 'a', locationName: 'Arcadia County Park', address: '405 South Santa Anita Avenue, Arcadia, California', latitude: 34.133, longitude: -118.035, mensCode: '#2468', womensCode: null, rating: 4, notes: 'Near the entrance.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open', ''); };
  vi.mocked(geocode).mockResolvedValue([{ displayName: record.address, latitude: record.latitude, longitude: record.longitude }]);
  vi.mocked(addRestroom).mockResolvedValue(record);
});
afterEach(cleanup);

it('blocks an empty form and explains the required fields', async () => {
  const user = userEvent.setup();
  render(<AddRestroomSheet onClose={vi.fn()} onSaved={vi.fn()} restrooms={[]} onView={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Add Restroom' }));
  expect(screen.getByRole('alert').textContent).toContain('required fields');
  expect(screen.getByText('Choose an address from the search results.')).toBeTruthy();
  expect(screen.getByText('Choose a rating from 1 to 5 stars.')).toBeTruthy();
  expect(addRestroom).not.toHaveBeenCalled();
});
it('searches an address, requires a selection, accepts keyboard stars and submits complete data', async () => {
  const user = userEvent.setup(); const saved = vi.fn();
  render(<AddRestroomSheet onClose={vi.fn()} onSaved={saved} restrooms={[]} onView={vi.fn()} />);
  await user.type(screen.getByLabelText(/Location name/), record.locationName);
  await user.type(screen.getByRole('combobox'), '405 South Santa Anita Avenue Arcadia');
  await user.click(await screen.findByRole('option', { name: record.address }, { timeout: 2500 }));
  expect(screen.getByTestId('pin-preview')).toBeTruthy();
  await user.type(screen.getByLabelText(/Men’s restroom code/), record.mensCode!);
  const star = screen.getByRole('radio', { name: '4 stars — Great' }); star.focus(); await user.keyboard(' ');
  await user.type(screen.getByLabelText(/Notes/), record.notes);
  await user.click(screen.getByRole('button', { name: 'Add Restroom' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(record));
  expect(addRestroom).toHaveBeenCalledWith(expect.objectContaining({ rating: 4, latitude: record.latitude, longitude: record.longitude, womensCode: null }));
});
it('warns about a nearby duplicate before submitting', async () => {
  const user = userEvent.setup(); const view = vi.fn();
  render(<AddRestroomSheet onClose={vi.fn()} onSaved={vi.fn()} restrooms={[record]} onView={view} />);
  await user.type(screen.getByLabelText(/Location name/), record.locationName);
  await user.type(screen.getByRole('combobox'), 'Arcadia County Park');
  await user.click(await screen.findByRole('option', { name: record.address }, { timeout: 2500 }));
  await user.click(screen.getByRole('radio', { name: '4 stars — Great' }));
  await user.click(screen.getByRole('button', { name: 'Add Restroom' }));
  expect(screen.getByText(/may already exist/)).toBeTruthy(); expect(addRestroom).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'View existing' })); expect(view).toHaveBeenCalledWith(record);
});
it('renders both code states, copies the code and uses coordinate directions', async () => {
  const user = userEvent.setup(); const notify = vi.fn();
  render(<RestroomDetailSheet restroom={record} notify={notify} onClose={vi.fn()} />);
  expect(screen.getByText('#2468')).toBeTruthy(); expect(screen.getByText('Not provided')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Copy men’s code' }));
  expect(copyText).toHaveBeenCalledWith('#2468'); expect(notify).toHaveBeenCalledWith('Code copied');
  expect(screen.getByRole('link', { name: 'Get Directions' }).getAttribute('href')).toContain('destination=34.133,-118.035');
});
