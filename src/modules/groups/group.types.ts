export interface CreateGroupDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateGroupDto {
  name?: string;
  description?: string;
  color?: string;
}
