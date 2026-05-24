import {
	type ContractVersion,
	version,
} from '../versioning/version';

type MaybePromise<T> = T | Promise<T>;

@version('1.0')
abstract class UseCase<Input = void, Output = void> {
	public static readonly CONTRACT_VERSION: ContractVersion;

	public get contractVersion(): ContractVersion {
		return UseCase.CONTRACT_VERSION;
	}

	public async run(input: Input): Promise<Output> {
		return await this.execute(input);
	}

	protected abstract execute(input: Input): MaybePromise<Output>;
}

export { type MaybePromise, UseCase };
