import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getProfileImageSource,
  getProfileInitials,
} from './profileAvatar.js'

test('authenticated avatar falls back to account initials when no image exists', () => {
  assert.equal(getProfileImageSource('', ''), undefined)
  assert.equal(
    getProfileInitials({ firstName: 'Jamie', lastName: 'Patient' }),
    'JP',
  )
})

test('authenticated avatar uses the saved image unless that image failed to load', () => {
  const imageUrl = 'https://images.example.test/profile.webp'
  assert.equal(getProfileImageSource(imageUrl, ''), imageUrl)
  assert.equal(getProfileImageSource(imageUrl, imageUrl), undefined)
})
