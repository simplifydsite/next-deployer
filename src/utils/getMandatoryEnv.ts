export const getMandatoryEnv = (variableName: string) => {
  const value = process.env[variableName]
  if (!value) {
    // eslint-disable-next-line no-console
    console.error(`failed to load env variable ${variableName}`)
    throw new Error(`${variableName} not set`)
  }
  return value
}
