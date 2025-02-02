import { AbletonLive } from './index';

interface ChildrenInitialProps {
	name: string;
	initialProps: string[];
}

export class Properties<GP, CP, TP, SP, OP> {

	protected _state = new Map();

	constructor(
		protected ableton: AbletonLive,
		protected ns: string,
		protected _path: string,
		protected childrenInitialProps?: Partial<{ [T in keyof CP]: (string | ChildrenInitialProps)[] }>,
		protected _id?: number
	) {}

	get id(): number | undefined {
		return this._id;
	}

	get path():string {
		return this._path;
	}

	/**
	 * @private
	 * Under construction
	 */
	// state<T extends keyof GP | keyof TP>(
	// 	key: T
	// ): T extends keyof TP ? undefined | TP[T] : T extends keyof GP ? undefined | GP[T] : any {
	// 	return this._state.get(key);
	// }

	protected getterTransformers: Partial<{ [T in keyof GP]: (val: GP[T]) => any }> = {};
	protected childrenTransformers: Partial<{ [T in keyof CP]: (val: CP[T]) => any }> = {};

	async get<T extends keyof GP>(prop: T): Promise<T extends keyof TP ? TP[T] : GP[T]> {
		const result = await this.ableton.get(this._path, prop as string, this._id);

		const transformer = this.getterTransformers[prop];

		let value = result;

		if (result !== null && transformer) {
			value = transformer(result);
		}

		// this._state.set(prop, value);

		return value;
	}

	async children<TName extends keyof CP>(child: TName, childProps?: InitialProps<TName,CP, TP>[], index?:number): Promise<PropertyType<TName,TP,CP>> {
		let initialProps;

		if (this.childrenInitialProps) {
			initialProps = this.childrenInitialProps[child];
		}

		if (childProps) {
			initialProps = initialProps.concat(childProps);
		}

		const result = await this.ableton.getChildren(this._path, { child: child as string, initialProps, index }, this._id);

		const transformer = this.childrenTransformers[child];

		if (result !== null && transformer) {
			return transformer(result);
		} else {
			return result;
		}
	}

	async child<TName extends OnlyKeysWithArrayValues<CP>>(child: TName, index:number, childProps?:  InitialProps<TName, CP, TP>[]): Promise<FlatPropertyType<TName,TP,CP>|undefined> {
		const result = await this.children(child, childProps, index);
		return (result??[])[0];
	}

	async set<T extends keyof SP>(prop: T, value: SP[T]): Promise<null> {
		return this.ableton.set(this._path, prop as string, value, this._id);
	}

	async observe<T extends keyof OP | keyof CP>(
		prop: T,
		listener: (data: T extends keyof OP ? OP[T] : T extends keyof TP ? TP[T] : any) => any
	): Promise<any> {
		const child = prop as any;
		const childTransformer = this.childrenTransformers[child as keyof CP];
		const getterTransformer = this.getterTransformers[child as keyof GP];

		let initialProps;

		const callback = (data) => {
			if (data !== null && childTransformer) {
				listener(childTransformer(data));
			} else if (data !== null && getterTransformer) {
				listener(getterTransformer(data));
			} else {
				listener(data);
			}
		};

		if (this.childrenInitialProps) {
			initialProps = this.childrenInitialProps[child];

			return this.ableton.observe(this._path, prop as string, callback, {
				initialProps,
				liveObjectId: this._id,
			});
		} else {
			return this.ableton.observe(this._path, prop as string, callback, {
				liveObjectId: this._id,
			});
		}
	}

	protected async call(method: string, parameters?: any[], timeout?: number): Promise<any> {
		return this.ableton.call(this._path, { parameters, method }, this._id, timeout);
	}

	protected async callMultiple(calls: any[][], timeout?: number): Promise<any> {
		return this.ableton.callMultiple(this._path, calls, this._id, timeout);
	}
}

type InitialProps<TName extends keyof CP, CP, TP> =
	| ChildProps<TName, CP, TP>
	| ChildChildren<TName, CP, TP>;

type ChildProps<TName extends keyof CP, CP, TP> = FlatPropertyType<
	TName,
	TP,
	CP
> extends Properties<infer GP, any, any, any, any>
	? keyof GP
	: never;

type ChildChildren<TName extends keyof CP, CP, TP> = FlatPropertyType<
	TName,
	TP,
	CP
> extends Properties<any, infer _CP, infer _TP, any, any>
	? ChildChildrenDescriptor<_CP, _TP, keyof _CP>
	: FlatPropertyType<
		TName,
		TP,
		CP
	>;

type ChildChildrenDescriptor<_CP, _TP, TName extends keyof _CP = any> = {
	name: TName;
	initialProps: InitialProps<TName, _CP, _TP>[];
};

type PropertyType<TName extends keyof CP, TP, CP> = TName extends keyof TP
	? TP[TName]
	: CP[TName];
	
type FlatPropertyType<TName extends keyof CP, TP, CP> = TName extends keyof TP
	? Flatten<TP[TName]>
	: Flatten<CP[TName]>;

type Flatten<T> = T extends Array<infer U> ? Flatten<U> : T;

type OnlyKeysWithArrayValues<T> = {
	[K in keyof T]: T[K] extends Array<any> ? K : never;
}[keyof T];
