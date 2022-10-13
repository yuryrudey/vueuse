import { collection, doc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { computed, nextTick, ref } from 'vue-demi'
import { useFirestore } from './index'

const dummyFirestore = {} as Firestore

const getMockSnapFromRef = (docRef: any) => ({
  id: `${docRef.path}-id`,
  data: () => (docRef),
})

const getData = (docRef: any) => {
  const data = docRef.data()
  Object.defineProperty(data, 'id', {
    value: docRef.id.toString(),
    writable: false,
  })
  return data
}

const unsubscribe = vi.fn()

vi.mock('firebase/firestore', () => {
  const doc = vi.fn((_: Firestore, path: string) => {
    if (path.includes('//'))
      throw new Error('Invalid segment')
    return { path }
  })

  const collection = vi.fn((_: Firestore, path: string) => {
    if (path.includes('//'))
      throw new Error('Invalid segment')
    return { path }
  })

  const onSnapshot = vi.fn((docRef: any, callbackFn: (payload: any) => {}) => {
    callbackFn({
      ...getMockSnapFromRef(docRef),
      docs: [getMockSnapFromRef(docRef)],
    })
    return unsubscribe
  })
  return { onSnapshot, collection, doc }
})

describe('useFirestore', () => {
  beforeEach(() => {
    unsubscribe.mockClear()
  })

  it('should get `users` collection data', () => {
    const collectionRef = collection(dummyFirestore, 'users')
    const data = useFirestore(collectionRef)
    expect(data.value).toEqual([getData(getMockSnapFromRef(collectionRef))])
  })

  it('should get `users/userId` document data', () => {
    const docRef = doc(dummyFirestore, 'users/userId')
    const data = useFirestore(docRef)
    expect(data.value).toEqual(getData(getMockSnapFromRef(docRef)))
  })

  it('should get `posts` computed query data', () => {
    const queryRef = collection(dummyFirestore, 'posts')
    const data = useFirestore(computed(() => queryRef))
    expect(data.value).toEqual([getData(getMockSnapFromRef(queryRef))])
  })

  it('should get initial value when pass falsy value', () => {
    const collectionRef = collection(dummyFirestore, 'todos')
    const falsy = computed(() => false as boolean && collectionRef)
    const data = useFirestore(falsy, [{ id: 'default' }])
    expect(data.value).toEqual([{ id: 'default' }])
  })

  it('should get reactive query data & unsubscribe previous query when re-querying', async () => {
    const queryRef = collection(dummyFirestore, 'posts')
    const reactiveQueryRef = ref(queryRef)
    const data = useFirestore(reactiveQueryRef)
    expect(data.value).toEqual([getData(getMockSnapFromRef(reactiveQueryRef.value))])
    reactiveQueryRef.value = collection(dummyFirestore, 'todos')
    await nextTick()
    expect(unsubscribe).toHaveBeenCalled()
    expect(data.value).toEqual([getData(getMockSnapFromRef(reactiveQueryRef.value))])
  })

  it('should get user data only when user id exists', async () => {
    const userId = ref('')
    const queryRef = computed(() => !!userId.value && collection(dummyFirestore, `users/${userId.value}/posts`))
    const data = useFirestore(queryRef, [{ id: 'default' }])
    expect(data.value).toEqual([{ id: 'default' }])
    userId.value = 'userId'
    await nextTick()
    expect(data.value).toEqual([getData(getMockSnapFromRef(collection(dummyFirestore, `users/${userId.value}/posts`)))])
    userId.value = ''
    await nextTick()
    expect(unsubscribe).toHaveBeenCalled()
    expect(data.value).toEqual([{ id: 'default' }])
  })
})
