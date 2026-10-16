import { ROLE_LABELS } from '@/lib/permissions';
import type { SharePermission } from '@/types/models';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS: SharePermission[] = ['read', 'write'];

export function PermissionPicker({
  value,
  onChange,
}: {
  value: SharePermission;
  onChange: (p: SharePermission) => void;
}) {
  return <SegmentedControl options={OPTIONS} labels={ROLE_LABELS} value={value} onChange={onChange} />;
}
