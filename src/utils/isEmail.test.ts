import { isEmail } from './isEmail'

it.each(['test123@example.com', 'super-duper-long_@e.de'])('handles valid emails', (mail) => {
  expect(isEmail(mail)).toBe(true)
})

it.each(['test%%#$@e.de', '1@ed.e', '', '@de.de'])('fails on invalid emails', (mail) => {
  expect(isEmail(mail)).toBe(false)
})