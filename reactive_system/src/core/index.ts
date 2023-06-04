type Getter<T> = () => T;
type Setter<T = unknown> = (v: T) => void;
type Equals = (val1: any, val2: any) => boolean;
type Options = { equals?: Equals };
let currentMemo: Memo | null = null;
export class Memo<T = any> {
	public fn: () => T;
	public dependencies: Set<Memo> = new Set();
	public subscribers: Set<Memo> = new Set();
	public cache: Record<string, string> = {};
	public value: any;
	public depsDirtyCount = 0;
	public dirty = false;
	private equals: Equals;
	// The owner of the created computation
	public owner = currentMemo;
	constructor(fn: () => T, options?: Options) {
		this.equals = options?.equals ?? ((v1: any, v2: any) => v1 === v2);
		this.fn = fn;
		this.update();
		return this;
	}
	update() {
		let prev = currentMemo;
		currentMemo = this;
		const newValue = this.fn();
		currentMemo = prev;
		if (this.equals(this.value, newValue)) {
			return;
		}
		this.value = newValue;
		// Mark children as dirty
		this.subscribers.forEach((sub) => (sub.dirty = true));

		// Node has been updated so is no longer dirty
		this.dirty = false;
	}
	track() {
		if (!currentMemo) return;
		this.subscribers.add(currentMemo);
		currentMemo.dependencies.add(this);
	}
	get: Getter<T> = () => {
		this.track();
		return this.value;
	};
	set: Setter<T> = (newVal) => {
		// No recomputations occur if the new value is the same as the old value
		if (this.equals(this.value, newVal)) return;
		this.value = newVal;
		this.notifySubscribers();
	};
	private increment() {
		this.depsDirtyCount++;
		if (this.depsDirtyCount === 1) {
			// This node has just updated, so it needs to notify all of its children to update
			this.subscribers.forEach((sub) => sub.increment());
		}
	}
	private decrement() {
		this.depsDirtyCount--;
		if (this.depsDirtyCount === 0) {
			if (this.dirty) {
				// We can now recompute
				this.update();
			}
			// Re-evaluate children
			this.subscribers.forEach((sub) => sub.decrement());
		}
	}
	private notifySubscribers = () => {
		this.subscribers.forEach((sub) => {
			sub.dirty = true;
			sub.increment();
		});
		this.subscribers.forEach((sub) => sub.decrement());
	};
}

/**
 * Gets the memo which owns the current computation
 * @returns The memo which owns the currently running computation
 */
export function getOwner() {
	return currentMemo;
}
/**
 * Runs the desired computation with the specified owner
 * @param owner The desired owner of the computation
 * @param fn The function to be run
 * @returns Result of the given function
 */
export function runWithOwner<T>(owner: Memo | null, fn: () => T) {
	let prev = currentMemo;
	currentMemo = owner;
	const result = fn();
	currentMemo = prev;
	return result;
}
/**
 * Gets the root owner of the current computation
 * @param owner The computation's owner
 * @returns The root owner of the computation
 */
export function getRoot(): Memo | null {
	let owner = getOwner();
	while (true) {
		if (!owner) {
			return null;
		}
		if (owner.owner === null) {
			return owner;
		}
		owner = owner.owner;
	}
}
