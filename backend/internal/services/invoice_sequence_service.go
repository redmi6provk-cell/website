package services

import "backend/internal/repository"

type InvoiceSequenceService struct {
	repo *repository.InvoiceSequenceRepository
}

func NewInvoiceSequenceService(repo *repository.InvoiceSequenceRepository) *InvoiceSequenceService {
	return &InvoiceSequenceService{repo: repo}
}

func (s *InvoiceSequenceService) PeekNextSalesInvoiceNumber() (string, error) {
	return s.repo.PeekNextSalesInvoiceNumber()
}

func (s *InvoiceSequenceService) NextSalesInvoiceNumber() (string, error) {
	return s.repo.NextSalesInvoiceNumber()
}
