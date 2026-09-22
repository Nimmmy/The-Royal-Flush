// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddRestroomSheet } from '../src/components/AddRestroomSheet';
import { RestroomDetailSheet } from '../src/components/RestroomDetailSheet';
import { addRestroom, updateRestroom, ApiError, copyText, geocode } from '../src/lib/api';
import type { Restroom } from '../src/types';
vi.mock('../src/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/lib/api')>();
  return { ...actual, addRestroom: vi.fn(), updateRestroom: vi.fn(), copyText: vi.fn(), geocode: vi.fn() };
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
it('registers a Safari address tap after validation, even though Safari does not focus buttons', async () => {
  const user = userEvent.setup(); const saved = vi.fn();
  render(<AddRestroomSheet onClose={vi.fn()} onSaved={saved} restrooms={[]} onView={vi.fn()} />);
  await user.type(screen.getByLabelText(/Location name/), record.locationName);
  await user.click(screen.getByRole('radio', { name: '4 stars — Great' }));
  await user.click(screen.getByRole('button', { name: 'Add Restroom' }));
  expect(screen.getByText('Choose an address from the search results.')).toBeTruthy();
  const input = screen.getByRole('combobox');
  await user.type(input, '405 South Santa Anita Avenue Arcadia');
  const option = await screen.findByRole('option', { name: record.address }, { timeout: 2500 });
  fireEvent.pointerDown(option, { pointerType: 'touch', pointerId: 1 });
  fireEvent.pointerUp(option, { pointerType: 'touch', pointerId: 1 });
  // Safari's compatibility mousedown blurs the input without focusing the button.
  // Like a browser default action, that blur must only run when mousedown isn't cancelled.
  if (fireEvent.mouseDown(option, { button: 0 })) fireEvent.blur(input, { relatedTarget: null });
  fireEvent.mouseUp(option, { button: 0 });
  fireEvent.click(option);
  expect(screen.getByTestId('pin-preview')).toBeTruthy();
  expect(screen.queryByText('Choose an address from the search results.')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Add Restroom' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(record));
  expect(addRestroom).toHaveBeenCalledWith(expect.objectContaining({ address: record.address, latitude: record.latitude, longitude: record.longitude }));
});
it('does not select an address when a touch becomes a scroll; keyboard selection still works', async () => {
  const user = userEvent.setup();
  render(<AddRestroomSheet onClose={vi.fn()} onSaved={vi.fn()} restrooms={[]} onView={vi.fn()} />);
  const input = screen.getByRole('combobox');
  await user.type(input, 'Arcadia County Park');
  const option = await screen.findByRole('option', { name: record.address }, { timeout: 2500 });
  fireEvent.pointerDown(option, { pointerType: 'touch', pointerId: 1 });
  fireEvent.pointerMove(option, { pointerType: 'touch', pointerId: 1, clientY: 80 });
  fireEvent.pointerCancel(option, { pointerType: 'touch', pointerId: 1 });
  expect(screen.queryByTestId('pin-preview')).toBeNull();
  expect(screen.getByRole('option', { name: record.address })).toBeTruthy();
  await user.keyboard('{ArrowDown}{Enter}');
  expect(screen.getByTestId('pin-preview')).toBeTruthy();
  expect(screen.queryByRole('listbox')).toBeNull();
});
it('renders both code states, copies the code and uses coordinate directions', async () => {
  const user = userEvent.setup(); const notify = vi.fn();
  render(<RestroomDetailSheet restroom={record} notify={notify} onEdit={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByText('#2468')).toBeTruthy(); expect(screen.getByText('Not provided')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Copy men’s code' }));
  expect(copyText).toHaveBeenCalledWith('#2468'); expect(notify).toHaveBeenCalledWith('Code copied');
  expect(screen.getByRole('link', { name: 'Get Directions' }).getAttribute('href')).toContain('destination=34.133,-118.035');
});


it('prefills the full listing and adds a men’s code without losing the women’s code or reselecting the address', async () => {
  const user = userEvent.setup(); const saved = vi.fn();
  const original = { ...record, mensCode: null, womensCode: '1357' };
  const updated = { ...original, mensCode: '2468' };
  vi.mocked(updateRestroom).mockResolvedValueOnce(updated);
  render(<AddRestroomSheet restroom={original} restrooms={[original]} onClose={vi.fn()} onSaved={saved} onView={vi.fn()} />);
  expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(original.address);
  expect((screen.getByLabelText(/Location name/) as HTMLInputElement).value).toBe(original.locationName);
  expect((screen.getByLabelText(/Women’s restroom code/) as HTMLInputElement).value).toBe('1357');
  expect((screen.getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe(original.notes);
  expect((screen.getByRole('radio', { name: '4 stars — Great' }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByTestId('pin-preview')).toBeTruthy();
  await user.type(screen.getByLabelText(/Men’s restroom code/), '2468');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(updateRestroom).toHaveBeenCalledWith(original, expect.objectContaining({ mensCode: '2468', womensCode: '1357', address: original.address, latitude: original.latitude, longitude: original.longitude, rating: 4, notes: original.notes }));
  expect(saved).toHaveBeenCalledWith(updated); expect(addRestroom).not.toHaveBeenCalled(); expect(geocode).not.toHaveBeenCalled();
});
it('edits the name, address, pin, codes, rating and notes', async () => {
  const user = userEvent.setup();
  vi.mocked(updateRestroom).mockResolvedValueOnce(record);
  const place = { displayName: '100 West Broadway, Glendale, California', latitude: 34.145, longitude: -118.256 };
  vi.mocked(geocode).mockResolvedValueOnce([place]);
  render(<AddRestroomSheet restroom={record} restrooms={[record]} onClose={vi.fn()} onSaved={vi.fn()} onView={vi.fn()} />);
  await user.clear(screen.getByLabelText(/Location name/)); await user.type(screen.getByLabelText(/Location name/), 'New name');
  await user.clear(screen.getByRole('combobox')); await user.type(screen.getByRole('combobox'), '100 West Broadway Glendale');
  await user.click(await screen.findByRole('option', { name: place.displayName }, { timeout: 2500 }));
  await user.click(screen.getByRole('button', { name: /Adjust pin with buttons/ }));
  await user.click(screen.getByRole('button', { name: 'Move pin north' }));
  await user.clear(screen.getByLabelText(/Men’s restroom code/)); await user.type(screen.getByLabelText(/Women’s restroom code/), 'Ask cashier');
  await user.click(screen.getByRole('radio', { name: '5 stars — Excellent' }));
  await user.clear(screen.getByLabelText(/Notes/)); await user.type(screen.getByLabelText(/Notes/), 'New notes');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(updateRestroom).toHaveBeenCalledWith(record, expect.objectContaining({ locationName: 'New name', address: place.displayName, latitude: place.latitude + 0.000045, longitude: expect.any(Number), mensCode: null, womensCode: 'Ask cashier', rating: 5, notes: 'New notes' }));
});
it('keeps unsaved edits on conflict and lets the contributor view the latest listing', async () => {
  const user = userEvent.setup(); const view = vi.fn(); const saved = vi.fn();
  const latest = { ...record, womensCode: 'New code' };
  vi.mocked(updateRestroom).mockRejectedValueOnce(new ApiError('Someone updated this restroom while you were editing.', undefined, latest));
  render(<AddRestroomSheet restroom={record} restrooms={[record]} onClose={vi.fn()} onSaved={saved} onView={view} />);
  await user.type(screen.getByLabelText(/Notes/), ' My change');
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(screen.getByRole('alert').textContent).toContain('Someone updated');
  expect((screen.getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe(record.notes + ' My change');
  expect(saved).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'View latest listing' })); expect(view).toHaveBeenCalledWith(latest);
});
it('opens editing from details and keeps the detail card when the form handles Escape', async () => {
  const user = userEvent.setup(); const edit = vi.fn(); const close = vi.fn();
  render(<RestroomDetailSheet restroom={record} notify={vi.fn()} onEdit={edit} onClose={close} />);
  await user.click(screen.getByRole('button', { name: 'Edit' })); expect(edit).toHaveBeenCalledOnce();
  render(<AddRestroomSheet restroom={record} restrooms={[record]} onClose={vi.fn()} onSaved={vi.fn()} onView={vi.fn()} />);
  await user.keyboard('{Escape}'); expect(close).not.toHaveBeenCalled();
});
