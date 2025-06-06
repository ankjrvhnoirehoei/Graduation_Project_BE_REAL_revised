import { applyDecorators, Type } from '@nestjs/common';
import { 
  ApiOkResponse, 
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels, 
  getSchemaPath,
  ApiProperty,
  ApiResponse as SwaggerApiResponse
} from '@nestjs/swagger';

// ==================== Base Response DTO ====================
export class ApiResponseDto<T = any> {
  @ApiProperty({ description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ required: false, description: 'Response data' })
  data?: T;

  @ApiProperty({ required: false, description: 'Error details if any' })
  error?: any;

  constructor(partial: Partial<ApiResponseDto<T>>) {
    Object.assign(this, partial);
  }
}

// ==================== Helper Types ====================
export type ResponseModel<T> = Type<T> | Function;
export type SchemaDefinition = Record<string, any>;

export interface ApiResponseOptions {
  status: number;
  description: string;
  response?: SchemaDefinition | ResponseModel<any>;
  isArray?: boolean;
  example?: any;
}

// ==================== Utility Functions ====================
const generateExampleFromSchema = (schema: SchemaDefinition): any => {
  const example: any = {};
  
  for (const [key, type] of Object.entries(schema)) {
    if (type === String) {
      example[key] = `sample-${key}`;
    } else if (type === Number) {
      example[key] = 123;
    } else if (type === Boolean) {
      example[key] = true;
    } else if (type === Date) {
      example[key] = new Date().toISOString();
    } else if (typeof type === 'object' && type.type) {
      // Handle complex type definitions like { type: String, example: 'custom' }
      if (type.example !== undefined) {
        example[key] = type.example;
      } else if (type.type === String) {
        example[key] = `sample-${key}`;
      } else if (type.type === Number) {
        example[key] = 123;
      } else if (type.type === Boolean) {
        example[key] = true;
      } else {
        example[key] = null;
      }
    } else if (typeof type === 'function') {
      // Handle class types
      example[key] = { id: 1, name: `sample-${key}` };
    } else {
      example[key] = null;
    }
  }
  
  return example;
};

const generateExampleFromType = (type: ResponseModel<any>): any => {
  if (type === String) return 'sample-string';
  if (type === Number) return 123;
  if (type === Boolean) return true;
  if (type === Date) return new Date().toISOString();
  
  // For class types, return a generic example
  return { id: 1, name: 'Sample Data' };
};

const buildSchemaProperties = (schema: SchemaDefinition): Record<string, any> => {
  const properties: Record<string, any> = {};
  
  for (const [key, type] of Object.entries(schema)) {
    if (type === String) {
      properties[key] = { type: 'string', example: `sample-${key}` };
    } else if (type === Number) {
      properties[key] = { type: 'number', example: 123 };
    } else if (type === Boolean) {
      properties[key] = { type: 'boolean', example: true };
    } else if (type === Date) {
      properties[key] = { type: 'string', format: 'date-time', example: new Date().toISOString() };
    } else if (typeof type === 'object' && type.type) {
      // Handle complex type definitions
      if (type.type === String) {
        properties[key] = { 
          type: 'string', 
          example: type.example || `sample-${key}`,
          description: type.description || undefined
        };
      } else if (type.type === Number) {
        properties[key] = { 
          type: 'number', 
          example: type.example || 123,
          description: type.description || undefined
        };
      } else if (type.type === Boolean) {
        properties[key] = { 
          type: 'boolean', 
          example: type.example !== undefined ? type.example : true,
          description: type.description || undefined
        };
      }
    } else if (typeof type === 'function') {
      // Handle class references
      properties[key] = { $ref: getSchemaPath(type as Type<any>) };
    } else {
      properties[key] = { type: 'object', nullable: true };
    }
  }
  
  return properties;
};

const buildResponseSchema = (response: SchemaDefinition | ResponseModel<any>, isArray: boolean = false) => {
  // Handle schema definition object
  if (typeof response === 'object' && response.constructor === Object) {
    const properties = buildSchemaProperties(response as SchemaDefinition);
    const example = generateExampleFromSchema(response as SchemaDefinition);
    
    const schema = {
      type: 'object',
      properties,
      example
    };
    
    return isArray ? { type: 'array', items: schema } : schema;
  }
  
  // Handle class types
  if (typeof response === 'function') {
    const baseSchema = { $ref: getSchemaPath(response as Type<any>) };
    return isArray ? { type: 'array', items: baseSchema } : baseSchema;
  }
  
  return null;
};

const getResponseDecorator = (status: number) => {
  switch (status) {
    case 200:
      return ApiOkResponse;
    case 201:
      return ApiCreatedResponse;
    case 204:
      return ApiNoContentResponse;
    case 400:
      return ApiBadRequestResponse;
    case 404:
      return ApiNotFoundResponse;
    case 500:
      return ApiInternalServerErrorResponse;
    default:
      return SwaggerApiResponse;
  }
};

export const ApiResponse = (options: ApiResponseOptions) => {
  const { status, description, response, isArray = false, example } = options;
  
  const decorators = [ApiExtraModels(ApiResponseDto)];
  
  // Add response type to extra models if it's a class
  if (response && typeof response === 'function') {
    decorators.push(ApiExtraModels(response as Type<any>));
  }

  // Build response schema and example
  let dataSchema: any = null;
  let responseExample: any = null;

  if (response) {
    dataSchema = buildResponseSchema(response, isArray);
    
    let sampleData: any;
    if (example) {
      sampleData = example;
    } else if (typeof response === 'object' && response.constructor === Object) {
      sampleData = generateExampleFromSchema(response as SchemaDefinition);
    } else {
      sampleData = generateExampleFromType(response as ResponseModel<any>);
    }
    
    responseExample = {

      message: description,
      data: isArray ? [sampleData] : sampleData,
      error: status >= 400 ? 'Error details' : null
    };
  } else {
    responseExample = {

      message: description,
      data: null,
      error: status >= 400 ? 'Error details' : null
    };
  }

  // Get appropriate decorator based on status code
  const ResponseDecorator = getResponseDecorator(status);
  
  const responseConfig: any = {
    description,
    schema: {
      allOf: [
        {
          properties: {
            data: dataSchema
          }
        }
      ],
      example: responseExample
    }
  };

  // For custom status codes, add status property
  if (![200, 201, 204, 400, 404, 500].includes(status)) {
    responseConfig.status = status;
  }

  return applyDecorators(
    ...decorators,
    ResponseDecorator(responseConfig)
  );
};