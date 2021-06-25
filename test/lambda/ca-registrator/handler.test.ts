import {
  IoTClient,
  GetRegistrationCodeCommand,
  RegisterCACertificateCommand,
  CreateTopicRuleCommand,
} from '@aws-sdk/client-iot';
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { handler } from '../../../lambda-assets/ca-registrator/app';
import {
  VerifierError,
  InputError,
} from '../../../lambda-assets/ca-registrator/errors';

const event = {
  body: {
    csrSubjects: {
      commonName: '',
      countryName: 'TW',
      stateName: 'TP',
      localityName: 'TW',
      organizationName: 'Soft Chef',
      organizationUnitName: 'web',
    },
    verifierName: 'test_verifier',
  },
};

const iotMock = mockClient(IoTClient);
const s3Mock = mockClient(S3Client);

beforeEach(() => {
  iotMock.on(GetRegistrationCodeCommand).resolves({
    registrationCode: 'registration_code',
  });
  iotMock.on(RegisterCACertificateCommand).resolves({
    certificateId: 'ca_certificate_id',
    certificateArn: 'ca_certificate_arn',
  });
  iotMock.on(CreateTopicRuleCommand).resolves({});
  s3Mock.on(PutObjectCommand).resolves({});
  process.env.DEIVCE_ACTIVATOR_QUEUE_URL = 'activator_queue_url';
  process.env.DEIVCE_ACTIVATOR_ROLE_ARN = 'activator_role_arn';
  process.env.AWS_REGION = 'local';
  process.env.test_verifier = 'arn:arn_of_test_verifier';
  process.env.BUCKET_NAME = 'bucket_name';
  process.env.BUCKET_PREFIX = 'bucket_prefix';
  process.env.BUCKET_KEY = 'bucket_key';
});

afterEach(() => {
  iotMock.reset();
  s3Mock.reset();
});

test('Sucessfully execute the handler', async () => {
  var response = await handler(event);
  expect(response.statusCode).toBe(200);
});

test('Sucessfully execute the handler with an empty event', async () => {
  var response = await handler();
  expect(response.statusCode).toBe(200);
});

test('Sucessfully execute the handler without providing a verifier', async () => {
  let eventWithoutVerifier: any = Object.assign({}, event);
  delete eventWithoutVerifier.body.verifierName;
  var response = await handler(eventWithoutVerifier);
  expect(response.statusCode).toBe(200);
});

test('Fail to upload the results', async () => {
  s3Mock.on(PutObjectCommand).rejects(new Error());
  var response = await handler(event);
  expect(response.statusCode).toBe(500);
});

test('Fail to create Rule', async () => {
  iotMock.on(CreateTopicRuleCommand).rejects(new Error());
  var response = await handler(event);
  expect(response.statusCode).toBe(500);
});

test('Fail to register CA', async () => {
  iotMock.on(RegisterCACertificateCommand).rejects(new Error());
  var response = await handler(event);
  expect(response.statusCode).toBe(500);
});

test('Fail to get CA registration code', async () => {
  iotMock.on(GetRegistrationCodeCommand).rejects(new Error());
  var response = await handler(event);
  expect(response.statusCode).toBe(500);
});

test('Fail when provide the wrong verifier', async () => {
  let eventWithWrongVerifier: any = Object.assign({}, event, {
    body: {
      verifierName: 'wrong',
      csrSubjects: {
        commonName: '',
        countryName: 'TW',
        stateName: 'TP',
        localityName: 'TW',
        organizationName: 'Soft Chef',
        organizationUnitName: 'web',
      },
    },
  });
  var response = await handler(eventWithWrongVerifier);
  expect(response.statusCode).toBe(VerifierError.code);
});

test('Fail when provide the wrong format of CSR subjects', async () => {
  let eventWithWrongFormatCsrSubject = Object.assign({}, event, {
    body: { csrSubjects: { commonName: {} } },
  });
  var response = await handler(eventWithWrongFormatCsrSubject);
  expect(response.statusCode).toBe(InputError.code);
});

test('Get Error Codes successfully', () => {
  expect(new VerifierError().code).toBe(VerifierError.code);
  expect(new InputError().code).toBe(InputError.code);
});