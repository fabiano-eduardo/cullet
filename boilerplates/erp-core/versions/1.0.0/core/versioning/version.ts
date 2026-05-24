type ContractVersion = `${number}.${number}`;

type VersionedTarget = {
	readonly prototype: object;
};

const CONTRACT_VERSION_PROPERTY = 'CONTRACT_VERSION' as const;
const CONTRACT_VERSION_PATTERN = /^\d+\.\d+$/;

function version<const TVersion extends ContractVersion>(
	contractVersion: TVersion
) {
	if (!CONTRACT_VERSION_PATTERN.test(contractVersion)) {
		throw new TypeError(
			`Invalid contract version "${contractVersion}". Expected MAJOR.MINOR.`
		);
	}

	return (target: VersionedTarget): void => {
		Object.defineProperty(target, CONTRACT_VERSION_PROPERTY, {
			value: contractVersion,
			writable: false,
			configurable: false,
			enumerable: false,
		});
	};
}

export {
	CONTRACT_VERSION_PROPERTY,
	type ContractVersion,
	version,
	type VersionedTarget,
};
