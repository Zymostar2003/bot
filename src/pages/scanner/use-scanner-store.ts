import { useStore } from '@/hooks/useStore';
import ScannerStore from '@/stores/scanner-store';

// RootStore (src/stores/root-store.ts) intentionally is NOT edited by this feature — the
// toolbar icon + overlay mount point (and the `root_store.scanner = new ScannerStore(this)`
// wiring that goes with it) is being added separately, after this port, to avoid conflicting
// with a parallel Smart Analysis feature build in the same working tree. This cast is a
// self-contained placeholder for that: it type-checks now, and once RootStore actually
// declares `scanner`, `useStore().scanner` resolves to the exact same instance this hook
// already returns — nothing here needs to change.
type TRootStoreWithScanner = ReturnType<typeof useStore> & { scanner: ScannerStore };

export const useScannerStore = (): ScannerStore => (useStore() as TRootStoreWithScanner).scanner;
